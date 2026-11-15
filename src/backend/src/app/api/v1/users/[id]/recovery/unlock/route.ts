import type { NextRequest } from "next/server";
import { services } from "../../../../../../../backend/composition/services";
import { handle,respond,sameOrigin,requestSession } from "../../../../../../../backend/transport/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function POST(request:NextRequest,context:{params:Promise<{id:string}>}) { return handle(async()=>{
 sameOrigin(request);return respond((await services().recovery.unlock((await requestSession(request)),(await context.params).id)));
}); }
