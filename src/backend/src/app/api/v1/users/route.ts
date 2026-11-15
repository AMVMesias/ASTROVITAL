import { NextRequest } from "next/server";
import { services } from "../../../../backend/composition/services";
import { handle, respond, sameOrigin, json, requestSession } from "../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return handle(async () => respond({ users: (await services().users.list((await requestSession(request)))) })); }
export function POST(request: NextRequest) { return handle(async () => { sameOrigin(request); const session=(await requestSession(request)); return respond({ user: (await services().users.save(session, await json(request))) },201); }); }
