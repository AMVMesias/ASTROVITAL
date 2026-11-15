import { NextRequest } from "next/server";
import { services } from "../../../../../backend/composition/services";
import { handle, respond, sameOrigin, json, SESSION_COOKIE, cookieOptions } from "../../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: NextRequest) { return handle(async () => {
  sameOrigin(request);
  const result = (await services().auth.login(await json(request)));
  const previous = request.cookies.get(SESSION_COOKIE)?.value;
  if (previous) { try { (await services().auth.logout((await services().auth.session(previous)))); } catch { /* sesión previa ya inválida */ } }
  const response = respond({ user: result.user, expiresAt: result.expiresAt });
  response.cookies.set(SESSION_COOKIE, result.token, { ...cookieOptions(), expires: new Date(result.expiresAt) });
  return response;
}); }
