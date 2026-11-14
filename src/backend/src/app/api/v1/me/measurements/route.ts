import { NextRequest } from "next/server";
import { localServices } from "../../../../../backend/composition/local";
import { handle, respond, sameOrigin, json, requestSession } from "../../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return handle(() => respond({ measurements: localServices().measurements.history(requestSession(request),request.nextUrl.searchParams) })); }
export function POST(request: NextRequest) { return handle(async () => { sameOrigin(request); const session=requestSession(request); const result=localServices().measurements.manual(session,await json(request)); return respond({...result,evaluation:await localServices().assessments.process(result.measurement.id)},201); }); }
