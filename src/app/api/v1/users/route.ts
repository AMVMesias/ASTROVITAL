import { NextRequest } from "next/server";
import { localServices } from "../../../../backend/composition/local";
import { handle, respond, sameOrigin, json, requestSession } from "../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return handle(() => respond({ users: localServices().users.list(requestSession(request)) })); }
export function POST(request: NextRequest) { return handle(async () => { sameOrigin(request); const session=requestSession(request); return respond({ user: localServices().users.save(session, await json(request)) },201); }); }
