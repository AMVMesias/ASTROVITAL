import type { NextRequest } from "next/server";
import { services } from "../../../../../../backend/composition/services";
import { handle,respond,sameOrigin,json } from "../../../../../../backend/transport/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function POST(request:NextRequest) { return handle(async()=>{sameOrigin(request);return respond((await services().recovery.verify(await json(request))));}); }
