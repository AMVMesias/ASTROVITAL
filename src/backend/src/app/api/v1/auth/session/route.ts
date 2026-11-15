import { NextRequest } from "next/server";
import { publicUser } from "../../../../../backend/application/auth/AuthService";
import { handle, respond, requestSession } from "../../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return handle(async () => { const session = (await requestSession(request)); return respond({ user: publicUser(session), expiresAt: session.expiresAt }); }); }
