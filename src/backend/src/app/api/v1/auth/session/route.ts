import { NextRequest } from "next/server";
import { publicUser } from "../../../../../backend/application/auth/AuthService";
import { handle, respond, requestSession, SESSION_COOKIE } from "../../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  const token=request.cookies.get(SESSION_COOKIE)?.value;
  if(!token || !/^[a-f0-9]{64}$/.test(token)) return respond({error:{code:"UNAUTHENTICATED",message:"Inicia sesión para continuar."}},401);
  return handle(async () => { const session = await requestSession(request); return respond({ user: publicUser(session), expiresAt: session.expiresAt }); });
}
