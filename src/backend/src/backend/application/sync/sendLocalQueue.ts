import type { LocalQueue } from "../sync-queue/LocalQueue";
import { syncBodyByteLimit, syncPending, type SyncMeasurement } from "./syncMeasurements";

export function sendLocalQueue(
  queue: LocalQueue,
  send: (measurements: readonly SyncMeasurement[]) => Promise<unknown>,
) {
  return syncPending({
    async listPending(limit) {
      const records = queue.pending(limit);
      const batch: SyncMeasurement[] = [];
      let bytes = Buffer.byteLength('{"measurements":[]}');
      for (const { payload } of records) {
        const next = Buffer.byteLength(JSON.stringify(payload)) + Number(batch.length > 0);
        if (bytes + next > syncBodyByteLimit) break;
        batch.push(payload);
        bytes += next;
      }
      if (records.length > 0 && batch.length === 0) throw new Error("Medición demasiado grande para sincronizar");
      if (batch.length > 0) queue.recordAttempt(batch.map(({ id }) => id));
      return batch;
    },
    async applyReceipts(receipts) {
      for (const receipt of receipts) {
        if (receipt.status === "accepted") queue.confirm(receipt.measurementId);
        else queue.reject(receipt.measurementId, receipt.reason);
      }
    },
  }, send);
}
