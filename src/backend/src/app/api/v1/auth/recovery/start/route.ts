import type { NextRequest } from "next/server";
import { localServices } from "../../../../../../backend/composition/local";
import { handle,respond,sameOrigin,json } from "../../../../../../backend/transport/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function POST(request:NextRequest) { return handle(async()=>{sameOrigin(request);return respond(localServices().recovery.start(await json(request)));}); }
