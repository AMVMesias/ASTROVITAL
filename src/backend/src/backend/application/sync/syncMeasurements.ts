import { indicatorConfig, type Measurement } from "../../domain/model";

export type SyncMeasurement = Measurement;
export type SyncReceipt =
  | { measurementId: string; status: "accepted" }
  | { measurementId: string; status: "rejected"; reason: string };

export const syncBatchLimit = 50;
export const syncBodyByteLimit = 96 * 1024;

export interface MeasurementOutbox {
  listPending(limit: number): Promise<readonly SyncMeasurement[]>;
  applyReceipts(receipts: readonly SyncReceipt[]): Promise<void>;
}

export interface MeasurementReceiver {
  store(measurement: SyncMeasurement): Promise<"accepted" | "conflict" | "unknown_environment">;
}

export function parseSyncBatch(input: unknown): SyncMeasurement[] {
  const records = (input as { measurements?: unknown } | null)?.measurements;
  if (!Array.isArray(records) || records.length === 0 || records.length > syncBatchLimit) {
    throw new Error("Lote inválido");
  }

  const ids = new Set<string>();
  return records.map((input: unknown) => {
    const row = input as Partial<SyncMeasurement> | null;
    const validText = (value: unknown): value is string =>
      typeof value === "string" && value.length <= 128 && value.trim().length > 0 && !value.includes("\0");
    const validDate = (value: unknown): value is string =>
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
      Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
    const config = row?.indicator && Object.hasOwn(indicatorConfig, row.indicator)
      ? indicatorConfig[row.indicator]
      : undefined;
    const environment = row?.environment;
    const nullableText = (value: unknown) => value === null || validText(value);
    if (!row || !config || !validText(row.id) || !validText(row.astronautId) ||
        !validText(row.missionId) || !validText(row.moduleId) ||
        row.unit !== config.unit || typeof row.value !== "number" || !Number.isFinite(row.value) ||
        row.value < config.min || row.value > config.max || (config.integer && !Number.isInteger(row.value)) ||
        !validDate(row.capturedAt) || !validDate(row.receivedAt) ||
        !nullableText(row.authorId) || !nullableText(row.deviceId) || !nullableText(row.readingId) ||
        !nullableText(row.scenario) || typeof row.note !== "string" || row.note.length > 1000 || row.note.includes("\0") ||
        !(row.activity === "rest" || row.activity === "exercise" || row.activity === "eva") ||
        !(row.origin === "manual" || row.origin === "device" || row.origin === "simulated") ||
        row.quality !== "valid" || !environment ||
        !validText(environment.scenarioId) || !validText(environment.profileId) ||
        !validText(environment.profileVersion) || !validText(environment.assignmentId) ||
        !(environment.scope === "cabin" || environment.scope === "exterior") ||
        typeof environment.telemetryAvailable !== "boolean" || ids.has(row.id)) {
      throw new Error("Medición inválida o repetida dentro del lote");
    }

    ids.add(row.id);
    return {
      id: row.id, astronautId: row.astronautId, missionId: row.missionId, moduleId: row.moduleId,
      indicator: row.indicator as Measurement["indicator"], unit: row.unit, value: row.value,
      origin: row.origin, quality: row.quality, capturedAt: row.capturedAt, receivedAt: row.receivedAt,
      authorId: row.authorId ?? null, deviceId: row.deviceId ?? null, readingId: row.readingId ?? null,
      scenario: row.scenario ?? null, note: row.note, activity: row.activity,
      environment: {
        scenarioId: environment.scenarioId, profileId: environment.profileId, profileVersion: environment.profileVersion,
        assignmentId: environment.assignmentId, scope: environment.scope, telemetryAvailable: environment.telemetryAvailable,
      },
    };
  });
}

export async function receiveMeasurements(
  receiver: MeasurementReceiver,
  missionId: string,
  measurements: readonly SyncMeasurement[],
): Promise<SyncReceipt[]> {
  const receipts: SyncReceipt[] = [];
  for (const measurement of measurements) {
    const result = measurement.missionId === missionId ? await receiver.store(measurement) : "mission_forbidden";
    receipts.push(result === "accepted"
      ? { measurementId: measurement.id, status: "accepted" }
      : { measurementId: measurement.id, status: "rejected", reason: result });
  }
  return receipts;
}

// Receipts are applied by the SQLite outbox owner. Rejected records remain visible for review.
export async function syncPending(
  outbox: MeasurementOutbox,
  send: (measurements: readonly SyncMeasurement[]) => Promise<unknown>,
): Promise<SyncReceipt[]> {
  const measurements = await outbox.listPending(syncBatchLimit);
  if (measurements.length === 0) return [];

  const reply = await send(measurements);
  const records = (reply as { receipts?: unknown } | null)?.receipts;
  const pending = new Set(measurements.map(({ id }) => id));
  if (!Array.isArray(records) || records.length !== pending.size) throw new Error("Confirmación incompleta");

  const receipts: SyncReceipt[] = records.map((input: unknown) => {
    const item = input as Partial<SyncReceipt> | null;
    if (!item || typeof item.measurementId !== "string" || !pending.delete(item.measurementId)) {
      throw new Error("Confirmación de medición inesperada");
    }
    if (item.status === "accepted") return { measurementId: item.measurementId, status: item.status };
    if (item.status === "rejected" && typeof item.reason === "string" && item.reason.length <= 128) {
      return { measurementId: item.measurementId, status: item.status, reason: item.reason };
    }
    throw new Error("Confirmación inválida");
  });

  await outbox.applyReceipts(receipts);
  return receipts;
}
