import type { NextRequest } from "next/server";
import { localServices } from "../../../../../../backend/composition/local";
import { handle,respond,sameOrigin,json,SESSION_COOKIE,cookieOptions } from "../../../../../../backend/transport/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function POST(request:NextRequest) { return handle(async()=>{
 sameOrigin(request);const result=localServices().recovery.resetPassword(await json(request));
 const response=respond(result);response.cookies.set(SESSION_COOKIE,"",{...cookieOptions(),maxAge:0});return response;
}); }
