/** Base configurable para la futura integración con el backend. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
  return response.json() as Promise<T>;
}
