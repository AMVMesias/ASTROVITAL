import { NextRequest } from "next/server";
import { localServices } from "../../../../../backend/composition/local";
import { handle, respond, sameOrigin, requestSession, SESSION_COOKIE, cookieOptions } from "../../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: NextRequest) { return handle(() => {
 sameOrigin(request); localServices().auth.logout(requestSession(request));
 const response = respond({ status: "signed_out" });
 response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 }); return response;
}); }
