import { DatabaseSync } from "node:sqlite";
import input from "../data/space_environment_surface_EVA_verified.json" with { type: "json" };
import { loadDocumentaryCatalog } from "../src/backend/src/backend/infrastructure/environment/documentaryCatalog.ts";
import {
  createSqliteEnvironmentRepository,
  migrateEnvironment,
  seedEnvironmentCatalog,
} from "../src/backend/src/backend/infrastructure/sqlite/environmentRepository.ts";

const path = process.argv[2];
if (!path) {
  console.error("Uso: node --experimental-strip-types scripts/seed-environment.mjs <base-de-prueba.sqlite>");
  process.exit(1);
}

const catalog = loadDocumentaryCatalog(input);
const database = new DatabaseSync(path);
try {
  migrateEnvironment(database);
  seedEnvironmentCatalog(database, catalog);
  const repository = createSqliteEnvironmentRepository(database);
  console.log("Revisión:", catalog.revision);
  for (const profile of repository.list(catalog.revision)) console.log(profile.id, profile.label);
} finally {
  database.close();
}
