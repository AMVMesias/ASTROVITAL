import { NextRequest } from "next/server";
import { services } from "../../../../../backend/composition/services";
import { handle, respond, requestSession } from "../../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return handle(async () => {
  const app=services(), session=(await requestSession(request));
  const summary=await app.measurements.summary(session);
  const telemetry=(await app.telemetry.history(session,new URLSearchParams(),true)).samples[0]??null;
  return respond({devices:summary.devices,telemetry});
}); }
