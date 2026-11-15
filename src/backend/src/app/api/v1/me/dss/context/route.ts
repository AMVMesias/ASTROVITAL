import type { NextRequest } from "next/server";
import { services } from "../../../../../../backend/composition/services";
import { handle,json,respond,requestSession,sameOrigin } from "../../../../../../backend/transport/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function PUT(request:NextRequest) {
  return handle(async()=>{sameOrigin(request);return respond(await services().dss.saveContext(await requestSession(request),await json(request)));});
}
export function DELETE(request:NextRequest) {
  return handle(async()=>{sameOrigin(request);return respond(await services().dss.clearContext(await requestSession(request)));});
}
