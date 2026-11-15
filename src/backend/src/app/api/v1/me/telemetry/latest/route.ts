import type { NextRequest } from "next/server";
import { services } from "../../../../../../backend/composition/services";
import { handle,respond,requestSession } from "../../../../../../backend/transport/http";
export const runtime="nodejs";
export function GET(request:NextRequest) {return handle(async ()=>respond((await services().telemetry.history((await requestSession(request)),request.nextUrl.searchParams,true))));}
