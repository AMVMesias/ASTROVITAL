import { NextRequest } from "next/server";
import { services } from "../../../../../backend/composition/services";
import { handle, respond, sameOrigin, requestSession, SESSION_COOKIE, cookieOptions } from "../../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: NextRequest) { return handle(async () => {
 sameOrigin(request); (await services().auth.logout((await requestSession(request))));
 const response = respond({ status: "signed_out" });
 response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 }); return response;
}); }
