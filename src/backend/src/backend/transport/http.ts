import { NextRequest, NextResponse } from "next/server";
import { services, withServices } from "../composition/services";
import { AppError, type Role } from "../domain/model";

export const SESSION_COOKIE = "nasa_session";
export function respond(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
export async function handle(work: () => Response | Promise<Response>) {
  const start=performance.now(),timing={connectionMs:0};
  let response:Response;
  try { response=await withServices(async () => await work(),timing); }
  catch (error) {
    if (error instanceof AppError) response=respond({ error: { code: error.code, message: error.message, fields: error.fields } }, error.status);
    else {
      console.error("NASA Health: operación no completada", error instanceof Error ? error.name : "UnknownError");
      response=respond({ error: { code: "INTERNAL", message: "No se pudo completar la operación." } }, 500);
    }
  }
  response.headers.set("Server-Timing",`db_connect;dur=${timing.connectionMs.toFixed(1)}, app;dur=${(performance.now()-start).toFixed(1)}`);
  return response;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new Set([new URL(request.url).origin]);
  if (process.env.APP_ORIGIN) allowed.add(process.env.APP_ORIGIN);
  if ((origin && !allowed.has(origin)) || request.headers.get("sec-fetch-site") === "cross-site") throw new AppError(403, "ORIGIN_DENIED", "Origen no autorizado.");
  // Las mutaciones de navegador sin Origin también deben llevar el encabezado de nuestra UI.
  if (!origin && request.headers.get("x-nasa-request") !== "1") throw new AppError(403, "ORIGIN_REQUIRED", "Incluye Origin o X-Nasa-Request: 1.");
}
export async function json(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new AppError(415, "JSON_REQUIRED", "Usa Content-Type: application/json.");
  // Limitar bytes antes de parsear; no confiar solo en Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "VALIDATION", "Falta el cuerpo JSON.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 16384) { await reader.cancel(); throw new AppError(413, "BODY_TOO_LARGE", "El cuerpo supera 16 KiB."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new AppError(400, "INVALID_JSON", "JSON inválido."); }
}
export async function requestSession(request: NextRequest, role?: Role) {
  const app = services();
  const session = (await app.auth.session(request.cookies.get(SESSION_COOKIE)?.value));
  return role ? (await app.auth.requireSession(session.sessionId, role)) : session;
}
export function cookieOptions() {
  return { httpOnly: true, sameSite: "strict" as const, secure: process.env.COOKIE_SECURE === "true" || !!process.env.VERCEL, path: "/" };
}
