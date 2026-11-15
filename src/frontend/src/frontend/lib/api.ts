export type User = { id: string; username: string; name: string; role: "admin" | "astronauta"; enabled: boolean; requiresOnboarding: boolean; astronautId: string | null; createdAt: string };
export class ApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(body?.error?.message ?? `Error HTTP ${response.status}`, response.status, body?.error?.code ?? "HTTP_ERROR");
  return body as T;
}
export function writeRequest(method: string, value?: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json", "X-Nasa-Request": "1" }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) };
}
