import { LocalAssessmentService } from "../application/assessment/LocalAssessmentService";
import { resolve } from "node:path";
import { AppError, type EnvironmentProvider } from "../domain/model";
import { SqliteRepository } from "../infrastructure/sqlite/SqliteRepository";
import { AuthService } from "../application/auth/AuthService";
import { UserService } from "../application/users/UserService";
import { MeasurementService } from "../application/measurements/MeasurementService";
<<<<<<< HEAD
import input from "../../../../../data/space_environment_surface_EVA_verified.json";
import { createMissionEnvironment } from "../application/environment/missionEnvironment";
import { createMeasurementAssessment } from "../application/assessment/measurementAssessment";
import { loadDocumentaryCatalog } from "../infrastructure/environment/documentaryCatalog";
import { createSqliteEnvironmentRepository, seedEnvironmentCatalog } from "../infrastructure/sqlite/environmentRepository";
import { createSqliteAlertRepository } from "../infrastructure/sqlite/alertRepository";

const catalog = loadDocumentaryCatalog(input);
=======
import { HistoricalEnvironmentProvider } from "../infrastructure/environment/HistoricalEnvironmentProvider";
>>>>>>> a7784becb2c9209f3c47237b12eb7c1f106069a9
import { LocalQueue } from "../application/sync-queue/LocalQueue";

export function localPath() {
  if (process.env.VERCEL || process.env.APP_MODE === "cloud") throw new AppError(503, "LOCAL_ONLY", "Las operaciones locales requieren Next.js con SQLite. El receptor PostgreSQL corresponde a persona 2.");
  // Archivo de ejecución local, nunca un recurso que deba copiarse al despliegue.
  return resolve(/* turbopackIgnore: true */ process.env.SQLITE_PATH || "data/local/nasa-health.sqlite");
}
<<<<<<< HEAD
export function createServices(repo: SqliteRepository, environment?: EnvironmentProvider) {
  const auth = new AuthService(repo);
  seedEnvironmentCatalog(repo.db, catalog);
  const assignments = createSqliteEnvironmentRepository(repo.db);
  const environments = environment ?? createMissionEnvironment(catalog, assignments, (astronautId) => {
    const mission = repo.get("SELECT mission_id FROM astronauts WHERE id = ?", astronautId);
    return typeof mission?.mission_id === "string" ? mission.mission_id : undefined;
  });
  const alerts = createSqliteAlertRepository(repo.db);
  const assessment = createMeasurementAssessment((id, query) => repo.measurements(id, query), alerts);
  return {
    repo, auth, catalog, assignments, environments, alerts,
    users: new UserService(repo, auth),
    measurements: new MeasurementService(repo, auth, environments, assessment),
    queue: new LocalQueue(repo),
  };
=======
export function createServices(repo: SqliteRepository, environment: EnvironmentProvider = new HistoricalEnvironmentProvider(repo)) {
  const auth = new AuthService(repo);
  const assessments = new LocalAssessmentService(repo);
  return { repo, auth, assessments, users: new UserService(repo, auth), measurements: new MeasurementService(repo, auth, environment,value=>assessments.preview(value)), queue: new LocalQueue(repo) };
>>>>>>> a7784becb2c9209f3c47237b12eb7c1f106069a9
}
let services: ReturnType<typeof createServices> | undefined;
export function localServices() { return services ??= createServices(new SqliteRepository(localPath())); }
