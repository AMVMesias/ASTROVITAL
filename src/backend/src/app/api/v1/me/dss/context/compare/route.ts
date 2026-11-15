import type { NextRequest } from "next/server";
import { services } from "../../../../../../../backend/composition/services";
import { handle,respond,requestSession } from "../../../../../../../backend/transport/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(request:NextRequest) {
  return handle(async()=>respond(await services().dss.compare(await requestSession(request))));
}
