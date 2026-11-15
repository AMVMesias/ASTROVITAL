import type { NextRequest } from "next/server";
import { localServices } from "../../../../../backend/composition/local";
import { handle,respond,requestSession } from "../../../../../backend/transport/http";
export const runtime="nodejs";
export function GET(request:NextRequest) {return handle(()=>respond(localServices().telemetry.history(requestSession(request),request.nextUrl.searchParams,false)));}
