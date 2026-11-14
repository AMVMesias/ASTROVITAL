import pg from "pg";
import input from "../data/space_environment_surface_EVA_verified.json" with { type: "json" };
import { loadDocumentaryCatalog } from "../src/backend/src/backend/infrastructure/environment/documentaryCatalog.ts";
import { provisionSyncSchema } from "../src/backend/src/backend/infrastructure/postgres/syncRepository.ts";

const connectionString = process.env.NASA_SYNC_DATABASE_URL;
if (!connectionString) throw new Error("Configura NASA_SYNC_DATABASE_URL");
const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5_000 });
try {
  const catalog = loadDocumentaryCatalog(input);
  await provisionSyncSchema(pool, catalog);
  console.log("Revisión ambiental disponible:", catalog.revision);
} finally {
  await pool.end();
}
