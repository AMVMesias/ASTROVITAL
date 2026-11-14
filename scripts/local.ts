import { loadEnvConfig } from "@next/env";
import { localPath, createServices } from "../src/backend/composition/local";
import { SqliteRepository } from "../src/backend/infrastructure/sqlite/SqliteRepository";
import { provisionDevice, seed } from "../src/backend/infrastructure/sqlite/seed";

loadEnvConfig(process.cwd());
const repo = new SqliteRepository(localPath());
try {
  const command = process.argv[2];
  if (command === "seed") {
    if (!process.env.ADMIN_PASSWORD) throw new Error("Configura ADMIN_PASSWORD en .env.local (mínimo 12 caracteres).");
    seed(repo, process.env.ADMIN_USERNAME ?? "admin", process.env.ADMIN_PASSWORD);
    console.log("Misión, módulo, indicadores y admin preparados; cuentas existentes conservadas.");
  } else if (command === "device") {
    if (!process.env.DEVICE_USERNAME || !process.env.DEVICE_TOKEN) throw new Error("Configura DEVICE_USERNAME y DEVICE_TOKEN (mínimo 32 caracteres).");
    provisionDevice(repo, process.env.DEVICE_USERNAME, process.env.DEVICE_ID ?? "esp32-demo", process.env.DEVICE_TOKEN);
    console.log("Dispositivo aprovisionado. La credencial no se imprime.");
  } else if (command === "revoke-device") {
    if (!process.env.DEVICE_ID) throw new Error("Configura DEVICE_ID.");
    repo.run("UPDATE devices SET enabled=0 WHERE id=?", process.env.DEVICE_ID);
    console.log("Dispositivo revocado; historial conservado.");
  } else if (command === "simulate") {
    if (!process.env.DEMO_USERNAME) throw new Error("Configura DEMO_USERNAME con una cuenta de astronauta existente.");
    const user = repo.accountByUsername(process.env.DEMO_USERNAME);
    if (!user?.astronautId) throw new Error("Astronauta inexistente.");
    const { measurements } = createServices(repo);
    // Identificador de ejecución explícito evita repetir una serie accidentalmente.
    const run = process.env.DEMO_RUN_ID ?? "stable-variation-v1";
    if (repo.get("SELECT id FROM measurements WHERE json_extract(payload,'$.scenario')=? LIMIT 1", run)) throw new Error("DEMO_RUN_ID ya ejecutado. Usa otro ID; no se borran datos.");
    const base = Date.now() - 12 * 86400_000;
    for (let day = 0; day < 12; day++) {
      if (day === 9) continue; // hueco explícito: no se inventa una lectura
      const capturedAt = new Date(base + day * 86400_000).toISOString();
      for (const [indicator, value, unit] of [["heart_rate", day < 7 ? 64 + day % 3 : 85 + day % 3, "bpm"], ["sleep", day < 7 ? 7.5 : 5.5, "h"], ["wellbeing", day < 7 ? 4 : 2, "score_1_5"]] as const) {
        measurements.simulated(user.astronautId, { indicator, value, unit, capturedAt, activity: "rest", note: "Serie sintética determinista; sin inferencia clínica." }, run);
      }
    }
    console.log("33 lecturas sintéticas creadas mediante el flujo de captura. Un día sin muestras.");
  } else if (command === "migrate") console.log("Migraciones aplicadas.");
  else throw new Error("Comandos: migrate, seed, device, revoke-device, simulate.");
} finally { repo.close(); }
