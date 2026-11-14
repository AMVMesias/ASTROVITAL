import { timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import {
  parseSyncBatch, receiveMeasurements, syncBodyByteLimit,
} from "../../../../../backend/application/sync/syncMeasurements";
import { createPostgresMeasurementReceiver } from "../../../../../backend/infrastructure/postgres/syncRepository";

export const runtime = "nodejs";
let pool: Pool | undefined;

export async function POST(request: Request) {
  const { NASA_SYNC_TOKEN: token, NASA_SYNC_MISSION_ID: missionId, NASA_SYNC_DATABASE_URL: connectionString } =
    process.env;
  if (!token || !missionId || !connectionString) {
    return Response.json({ error: "sync_unavailable" }, { status: 503 });
  }

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const reader = request.body?.getReader();
  let measurements;
  try {
    if (!reader) throw new Error("Falta el lote");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > syncBodyByteLimit) {
        await reader.cancel();
        return Response.json({ error: "batch_too_large" }, { status: 413 });
      }
      chunks.push(chunk.value);
    }
    measurements = parseSyncBatch(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    return Response.json({ error: "invalid_batch" }, { status: 400 });
  }

  try {
    pool ??= new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5_000 });
    const receipts = await receiveMeasurements(createPostgresMeasurementReceiver(pool), missionId, measurements);
    return Response.json({ receipts });
  } catch {
    return Response.json({ error: "sync_unavailable" }, { status: 503 });
  }
}
