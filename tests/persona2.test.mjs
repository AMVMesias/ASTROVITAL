import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { assessMeasurements } from "../src/backend/src/backend/application/assessment/assessMeasurements.ts";
import { createAstronautAlerts, recordAssessment } from "../src/backend/src/backend/application/alerts/alerts.ts";
import { createSqliteAlertRepository, migrateAlerts } from "../src/backend/src/backend/infrastructure/sqlite/alertRepository.ts";
import { parseSyncBatch, receiveMeasurements, syncPending } from "../src/backend/src/backend/application/sync/syncMeasurements.ts";

const now = new Date("2026-11-14T12:00:00.000Z");
const rule = {
  version: "demo-1", referenceWindowMs: 60 * 60_000, maxAgeMs: 5 * 60_000,
  minimumSamples: 3, consecutiveSamples: 2, absoluteDeviation: 10,
};
const measurement = {
  id: "m5", missionId: "demo", astronautId: "a1", indicator: "pulse", unit: "bpm",
  value: 85, origin: "simulado", quality: "valid", activity: "rest",
  capturedAt: now.toISOString(), receivedAt: now.toISOString(),
  environment: { scenarioId: "iss_leo", revision: "a".repeat(64) },
};
const history = [60, 60, 60, 84].map((value, index) => ({
  ...measurement, id: `m${index}`, value,
  capturedAt: new Date(now.getTime() - (4 - index) * 60_000).toISOString(),
}));
const astronaut = { role: "astronauta", userId: "u1", astronautId: "a1", missionId: "demo" };

test("assesses compatible history, isolates simulated data and distinguishes stale and invalid", () => {
  const outcome = assessMeasurements(measurement, history, rule, now);
  assert.equal(outcome.status, "deviation");
  assert.equal(outcome.direction, "above");
  assert.equal(outcome.reference.mean, 60);
  assert.deepEqual(outcome.evidence, ["m3", "m5"]);
  assert.equal(assessMeasurements({ ...measurement, value: 60 }, history, rule, now).status, "stable");
  assert.equal(assessMeasurements(measurement, [], rule, now).status, "insufficient");
  assert.equal(assessMeasurements({ ...measurement, origin: "sensor" }, history, rule, now).status, "insufficient");
  assert.equal(assessMeasurements({ ...measurement, quality: "invalid" }, history, rule, now).status, "invalid");
  const stale = assessMeasurements(measurement, history, rule, new Date("2026-11-14T12:06:00Z"));
  assert.equal(stale.status, "stale");
  assert.equal(stale.recommendation.action, "repeat_reading");
});

test("re-evaluation keeps one alert and its owner retains the action history", (context) => {
  const database = new DatabaseSync(":memory:");
  context.after(() => database.close());
  migrateAlerts(database);
  const repository = createSqliteAlertRepository(database);
  const outcome = assessMeasurements(measurement, history, rule, now);
  const alert = recordAssessment(repository, measurement, outcome, now);
  const owner = createAstronautAlerts(repository, astronaut);
  const other = createAstronautAlerts(repository, { ...astronaut, astronautId: "a2" });
  assert.equal(createAstronautAlerts(repository, { role: "admin" }), undefined);
  assert.equal(other.detail(alert.id), undefined);
  assert.equal(other.act(alert.id, "close", undefined, now), "not_found");
  assert.equal(owner.act(alert.id, "track", "Lectura revisada", now), "recorded");
  assert.equal(owner.act(alert.id, "close", undefined, now), "recorded");
  assert.equal(owner.act(alert.id, "track", undefined, now), "closed");
  assert.equal(recordAssessment(repository, measurement, outcome, now).status, "closed");
  assert.equal(owner.list().length, 1);
  assert.deepEqual(owner.detail(alert.id).actions.map((action) => [action.type, action.authorId]), [
    ["track", "u1"], ["close", "u1"],
  ]);
});

test("sync preserves the outbox after lost or malformed receipts and scopes incoming data", async () => {
  const payload = {
    ...measurement, indicator: "heart_rate", origin: "simulated", moduleId: "module",
    authorId: "u1", deviceId: null, readingId: null, note: "", scenario: "demo",
    environment: { scenarioId: "iss_leo", profileId: "iss_leo", profileVersion: "a".repeat(64),
      assignmentId: "assignment", scope: "cabin", telemetryAvailable: false },
  };
  const batch = parseSyncBatch({ measurements: [payload] });
  assert.deepEqual(batch, [payload]);
  let applied;
  const outbox = { listPending: async () => batch, applyReceipts: async (rows) => { applied = rows; } };
  await assert.rejects(syncPending(outbox, async () => { throw new Error("lost"); }), /lost/);
  await assert.rejects(syncPending(outbox, async () => ({ receipts: [] })), /incompleta/);
  assert.equal(applied, undefined);
  const receiver = { store: async () => "accepted" };
  const receipts = await syncPending(outbox, async (rows) => ({
    receipts: await receiveMeasurements(receiver, "demo", rows),
  }));
  assert.deepEqual(applied, receipts);
  assert.deepEqual(await receiveMeasurements(receiver, "other", batch), [
    { measurementId: measurement.id, status: "rejected", reason: "mission_forbidden" },
  ]);
});

test("selects orientation from trend direction, activity and data quality", () => {
  function evaluate(indicator, activity, baseline, latest, changes = {}) {
    const sample = { ...measurement, indicator, activity, value: latest, ...changes };
    const series = [baseline, baseline, baseline, latest].map((value, index) => ({
      ...history[index], indicator, activity, value,
    }));
    return assessMeasurements(sample, series, rule, now);
  }

  for (const [activity, suffix] of [["rest", "rest"], ["exercise", "exercise"], ["eva", "eva"], [undefined, "unknown-activity"]]) {
    const result = evaluate("heart_rate", activity, 60, 75);
    assert.equal(result.direction, "above");
    assert.equal(result.recommendation.id, `pulse-${suffix}`);
  }
  const sleepRule = { ...rule, absoluteDeviation: 1.5 };
  for (const [value, direction] of [[6.5, "below"], [9.5, "above"]]) {
    const sleep = { ...measurement, indicator: "sleep", unit: "h", value };
    const sleepHistory = history.map((reading, index) => ({
      ...reading, indicator: "sleep", unit: "h", value: index === 3 ? value : 8,
    }));
    const result = assessMeasurements(sleep, sleepHistory, sleepRule, now);
    assert.equal(result.direction, direction);
    assert.equal(result.recommendation.id, `sleep-${direction}-baseline`);
  }

  assert.equal(evaluate("wellbeing", "rest", 60, 45).recommendation.id, "wellbeing-change");
  assert.equal(evaluate("heart_rate", "rest", 60, 75, { quality: "invalid" }).recommendation.action, "repeat_reading");
  assert.equal(evaluate("heart_rate", "rest", 60, 75, {
    environment: { ...measurement.environment, scenarioId: "moon_surface" },
  }).recommendation.action, "collect_history");
  assert.equal(evaluate("heart_rate", "rest", 60, 65).recommendation, undefined);
  const withIsolatedPeak = history.map((reading) => ({ ...reading, value: 60 }));
  const peak = assessMeasurements(measurement, withIsolatedPeak, rule, now);
  assert.equal(peak.status, "stable");
  assert.equal(peak.recommendation, undefined);
});
