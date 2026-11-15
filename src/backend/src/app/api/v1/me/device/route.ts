import { NextRequest } from "next/server";
import { localServices } from "../../../../../backend/composition/local";
import { handle, respond, requestSession } from "../../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return handle(() => {
  const app=localServices(), session=requestSession(request);
  const summary=app.measurements.summary(session);
  const telemetry=app.telemetry.history(session,new URLSearchParams(),true).samples[0]??null;
  return respond({devices:summary.devices,telemetry});
}); }
