import { NextRequest } from "next/server";
import { services } from "../../../../../backend/composition/services";
import { handle, respond, sameOrigin, json, requestSession } from "../../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest, context: { params: Promise<{id:string}> }) { return handle(async () => respond({ user: (await services().users.get((await requestSession(request)),(await context.params).id)) })); }
export function PATCH(request: NextRequest, context: { params: Promise<{id:string}> }) { return handle(async () => { sameOrigin(request); const session=(await requestSession(request)); return respond({ user: (await services().users.save(session, await json(request), (await context.params).id)) }); }); }
