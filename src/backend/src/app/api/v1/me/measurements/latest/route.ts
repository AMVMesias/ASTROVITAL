import { NextRequest } from "next/server";
import { localServices } from "../../../../../../backend/composition/local";
import { handle, respond, requestSession } from "../../../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return handle(() => respond(localServices().measurements.summary(requestSession(request)))); }
