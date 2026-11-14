import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";
import input from "../data/space_environment_surface_EVA_verified.json" with { type: "json" };
import { loadDocumentaryCatalog } from "../src/backend/src/backend/infrastructure/environment/documentaryCatalog.ts";
import { createPostgresMeasurementReceiver, provisionSyncSchema } from "../src/backend/src/backend/infrastructure/postgres/syncRepository.ts";
import { createMeasurementSender } from "../src/backend/src/backend/infrastructure/http/sendMeasurements.ts";
import { syncPending } from "../src/backend/src/backend/application/sync/syncMeasurements.ts";

const databaseUrl = process.env.NASA_SYNC_TEST_DATABASE_URL;

test("receives repeatable batches through the Next.js route into PostgreSQL", {
  skip: !databaseUrl || !process.env.NASA_SYNC_TEST_ENDPOINT,
}, async (context) => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  context.after(() => pool.end());
  const catalog = loadDocumentaryCatalog(input);
  await provisionSyncSchema(pool, catalog);
  await provisionSyncSchema(pool, catalog);
  const sent = {
    id: randomUUID(), astronautId: "demo-a", missionId: "demo", indicator: "heart_rate",
    unit: "bpm", value: 70, quality: "valid", origin: "simulated",
    capturedAt: "2026-11-14T12:00:00.000Z", receivedAt: "2026-11-14T12:00:00.000Z",
    moduleId: "module", activity: "rest", authorId: "u1", deviceId: null, readingId: null, note: "", scenario: "demo",
    environment: { scenarioId: "iss_leo", profileId: "iss_leo", profileVersion: catalog.revision,
      assignmentId: "assignment", scope: "cabin", telemetryAvailable: false },
  };
  const endpoint = new URL(process.env.NASA_SYNC_TEST_ENDPOINT);
  const sender = createMeasurementSender(endpoint, process.env.NASA_SYNC_TOKEN);
  await assert.rejects(createMeasurementSender(endpoint, "wrong")([sent]), /401/);
  let applied;
  const outbox = { listPending: async () => [sent], applyReceipts: async (receipts) => { applied = receipts; } };
  await assert.rejects(syncPending(outbox, async (rows) => {
    await sender(rows);
    throw new Error("lost confirmation");
  }), /lost confirmation/);
  assert.equal(applied, undefined);
  const accepted = await syncPending(outbox, sender);
  assert.deepEqual(accepted, [{ measurementId: sent.id, status: "accepted" }]);
  assert.deepEqual(applied, accepted);

  const receiver = createPostgresMeasurementReceiver(pool);
  assert.equal(await receiver.store({ ...sent, value: 71 }), "conflict");
  const missing = { ...sent, id: randomUUID(), environment: { ...sent.environment, profileVersion: "0".repeat(64) } };
  const unauthorized = { ...sent, id: randomUUID(), missionId: "other" };
  assert.deepEqual((await sender([missing, unauthorized])).receipts, [
    { measurementId: missing.id, status: "rejected", reason: "unknown_environment" },
    { measurementId: unauthorized.id, status: "rejected", reason: "mission_forbidden" },
  ]);
  const count = await pool.query("SELECT count(*)::int AS total FROM synced_measurements WHERE measurement_id = $1", [sent.id]);
  assert.equal(count.rows[0].total, 1);
});
