import assert from "node:assert/strict";
import { test } from "node:test";
import { MeasurementService } from "../src/backend/src/backend/application/measurements/MeasurementService";
import { AuthService } from "../src/backend/src/backend/application/auth/AuthService";
import { personal } from "../src/backend/src/backend/application/assessment/AssessmentService";
import { digest } from "../src/backend/src/backend/infrastructure/security/credentials";
import type { Repository } from "../src/backend/src/backend/domain/repository";
import type {
  Account,
  EnvironmentContext,
  Measurement,
  Session,
} from "../src/backend/src/backend/domain/model";
import {
  readingContext,
  readingFreshness,
  readingAssessment,
  type Reading,
} from "../src/frontend/src/frontend/features/dashboard/readingPresentation";

const environment: EnvironmentContext = {
  scenarioId: "iss_leo",
  profileId: "iss",
  profileVersion: "v1",
  scope: "cabin",
  assignmentId: "assignment",
  telemetryAvailable: false,
};
function fixture() {
  const accounts: Account[] = ["astro", "other", "admin"].map((id) => ({
    id,
    username: id,
    name: id,
    role: id === "admin" ? "admin" : "astronauta",
    passwordHash: "unused",
    enabled: true,
    requiresOnboarding: false,
    astronautId: id === "admin" ? null : id,
    missionId: "mission",
    moduleId: "module",
    createdAt: new Date().toISOString(),
  }));
  const saved = new Map<
    string,
    { measurement: Measurement; fingerprint: string }
  >();
  let requestedOwner: string | undefined;
  const repo = {
    atomic: async <T>(work: () => Promise<T>) => work(),
    session: async (id: string) => ({
      userId: id,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    }),
    account: async (id: string) => accounts.find((a) => a.id === id) ?? null,
    users: async () => accounts,
    device: async () => ({
      id: "esp32",
      astronautId: "astro",
      enabled: true,
      credentialHash: digest("token"),
    }),
    deviceReading: async (_id: string, readingId: string) =>
      saved.get(readingId) ?? null,
    saveMeasurement: async (measurement: Measurement, fingerprint: string) => {
      saved.set(measurement.readingId ?? measurement.id, {
        measurement,
        fingerprint,
      });
    },
    touchDevice: async () => {},
    signalStatus: async () => {},
    devices: async () => [],
    latest: async (owner: string) => {
      requestedOwner = owner;
      return [...saved.values()]
        .map((v) => v.measurement)
        .filter((m) => m.astronautId === owner);
    },
    measurements: async (owner: string) => {
      requestedOwner = owner;
      return [...saved.values()]
        .map((v) => v.measurement)
        .filter((m) => m.astronautId === owner);
    },
  } as unknown as Repository;
  const service = new MeasurementService(repo, new AuthService(repo), {
    resolve: async () => environment,
  });
  const session = (id: string) =>
    ({
      ...accounts.find((a) => a.id === id)!,
      sessionId: id,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    }) as Session;
  return { service, saved, session, owner: () => requestedOwner };
}
const input = () => ({
  readingId: "r1",
  indicator: "heart_rate",
  value: 72,
  unit: "bpm",
  capturedAt: new Date().toISOString(),
});

test("ESP32 absent activity remains unknown and explicit context is persisted with provenance", async () => {
  const { service } = fixture();
  const value = input();
  const first = await service.fromDevice("esp32", "token", value);
  assert.equal(first.measurement.activity, "unknown");
  assert.equal(first.measurement.activityConfirmed, false);
  assert.equal(first.measurement.origin, "device");
  assert.equal(first.measurement.readingId, value.readingId);
  assert.equal(first.measurement.capturedAt, value.capturedAt);
  assert.equal(first.measurement.quality, "valid");
  const second = await service.fromDevice("esp32", "token", {
    ...value,
    readingId: "rest",
    activity: "rest",
  });
  assert.equal(second.measurement.activity, "rest");
  assert.equal(second.measurement.activityConfirmed, true);
  assert.equal(personal(second.measurement).activity, "rest");
  for (const activity of [null, "sleeping", 1, false])
    await assert.rejects(
      service.fromDevice("esp32", "token", { ...value, activity }),
      { code: "VALIDATION" },
    );
});
test("device deduplication and conflicts survive unknown context and legacy retries", async () => {
  const { service, saved } = fixture();
  const value = input();
  const first = await service.fromDevice("esp32", "token", value);
  const duplicate = await service.fromDevice("esp32", "token", value);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.measurement.id, first.measurement.id);
  await assert.rejects(
    service.fromDevice("esp32", "token", { ...value, activity: "rest" }),
    { code: "READING_CONFLICT" },
  );
  const legacy = { ...first.measurement, activity: "rest" as const };
  delete legacy.activityConfirmed;
  saved.set(value.readingId, {
    measurement: legacy,
    fingerprint: digest(
      JSON.stringify({
        indicator: value.indicator,
        value: value.value,
        unit: value.unit,
        capturedAt: value.capturedAt,
        activity: "rest",
        note: "",
      }),
    ),
  });
  const retry = await service.fromDevice("esp32", "token", value);
  assert.equal(retry.duplicate, true);
  assert.deepEqual(retry.measurement, legacy);
  assert.equal(personal(retry.measurement).activity, "unknown");
  assert.equal(
    retry.measurement.activity,
    "rest",
    "legacy payload is never rewritten",
  );
  await assert.rejects(
    service.fromDevice("esp32", "token", { ...value, value: 73 }),
    { code: "READING_CONFLICT" },
  );
});
test("astronaut permissions, identity filters, format validation and other indicators remain intact", async () => {
  const { service, session, owner } = fixture();
  await service.fromDevice("esp32", "token", input());
  assert.equal((await service.summary(session("astro"))).latest.length, 1);
  assert.equal(owner(), "astro");
  assert.equal((await service.summary(session("other"))).latest.length, 0);
  assert.equal(owner(), "other");
  assert.equal(
    (await service.history(session("other"), new URLSearchParams())).length,
    0,
  );
  await assert.rejects(service.summary(session("admin")), {
    code: "FORBIDDEN",
  });
  await assert.rejects(
    service.history(session("admin"), new URLSearchParams()),
    { code: "FORBIDDEN" },
  );
  await assert.rejects(service.fromDevice("esp32", "wrong", input()), {
    code: "DEVICE_UNAUTHORIZED",
  });
  await assert.rejects(
    service.fromDevice("esp32", "token", { ...input(), value: NaN }),
    { code: "VALIDATION" },
  );
  await assert.rejects(
    service.fromDevice("esp32", "token", {
      ...input(),
      indicator: "sleep",
      unit: "h",
    }),
    { code: "VALIDATION" },
  );
  await assert.rejects(service.manual(session("astro"), input()), {
    code: "VALIDATION",
  });
  const sleep = await service.manual(session("astro"), {
    indicator: "sleep",
    value: 7.5,
    unit: "h",
    capturedAt: new Date().toISOString(),
    activity: "rest",
  });
  assert.equal(sleep.measurement.value, 7.5);
  assert.equal(sleep.measurement.indicator, "sleep");
});
test("frontend distinguishes current, confirmed rest, legacy context and configured freshness", () => {
  const reading: Reading = {
    ...input(),
    id: "current",
    indicator: "heart_rate",
    origin: "device",
    quality: "valid",
    activity: "exercise",
    activityConfirmed: true,
    maxAgeSeconds: 30,
  };
  assert.equal(readingContext(reading), "exercise");
  assert.equal(readingContext({ ...reading, activity: "rest" }), "rest");
  assert.equal(
    readingContext({
      ...reading,
      activity: "rest",
      activityConfirmed: undefined,
    }),
    "unknown",
  );
  assert.equal(readingContext({ ...reading, activity: undefined }), "unknown");
  assert.equal(
    readingFreshness(reading, Date.parse(reading.capturedAt) + 31000),
    "stale",
  );
  assert.equal(
    readingFreshness(reading, Date.parse(reading.capturedAt) + 1000),
    "fresh",
  );
  assert.equal(
    readingFreshness({ ...reading, maxAgeSeconds: undefined }, Date.now()),
    "unknown",
  );
  assert.equal(
    readingAssessment(reading, [
      {
        measurementId: "older",
        indicator: "heart_rate",
        status: "stable",
        ruleVersion: "test",
      },
    ]),
    undefined,
  );
});
