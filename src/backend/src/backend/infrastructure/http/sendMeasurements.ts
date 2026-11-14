import type { SyncMeasurement } from "../../application/sync/syncMeasurements";

export function createMeasurementSender(endpoint: URL, token: string) {
  if (endpoint.protocol !== "https:" &&
      !(endpoint.protocol === "http:" && endpoint.hostname === "127.0.0.1")) {
    throw new Error("La sincronización requiere HTTPS");
  }

  return async (measurements: readonly SyncMeasurement[]): Promise<unknown> => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ measurements }),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Sincronización HTTP ${response.status}`);
    return response.json();
  };
}
