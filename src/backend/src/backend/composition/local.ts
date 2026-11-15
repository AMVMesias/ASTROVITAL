import { TelemetryService } from "../application/measurements/TelemetryService";
import { RecoveryService } from "../application/auth/RecoveryService";
import { LocalAssessmentService } from "../application/assessment/LocalAssessmentService";
import { resolve } from "node:path";
import { AppError, type EnvironmentProvider } from "../domain/model";
import { SqliteRepository } from "../infrastructure/sqlite/SqliteRepository";
import { AuthService } from "../application/auth/AuthService";
import { UserService } from "../application/users/UserService";
import { MeasurementService } from "../application/measurements/MeasurementService";
import { HistoricalEnvironmentProvider } from "../infrastructure/environment/HistoricalEnvironmentProvider";
import { createSqliteAlertRepository } from "../infrastructure/sqlite/alertRepository";
import { LocalQueue } from "../application/sync-queue/LocalQueue";

export function localPath() {
  if (process.env.VERCEL || process.env.APP_MODE === "cloud") throw new AppError(503, "LOCAL_ONLY", "Las operaciones locales requieren Next.js con SQLite. El receptor PostgreSQL corresponde a persona 2.");
  // Archivo de ejecución local, nunca un recurso que deba copiarse al despliegue.
  return resolve(/* turbopackIgnore: true */ process.env.SQLITE_PATH || "data/local/nasa-health.sqlite");
}
export function createServices(repo: SqliteRepository, environment: EnvironmentProvider = new HistoricalEnvironmentProvider(repo)) {
  const auth = new AuthService(repo);
  const assessments = new LocalAssessmentService(repo);
  return { repo, auth, telemetry:new TelemetryService(repo,auth), alerts:createSqliteAlertRepository(repo.db), recovery:new RecoveryService(repo,auth), assessments, users: new UserService(repo, auth), measurements: new MeasurementService(repo, auth, environment,value=>assessments.preview(value)), queue: new LocalQueue(repo) };
}
let services: ReturnType<typeof createServices> | undefined;
export function localServices() { return services ??= createServices(new SqliteRepository(localPath())); }
