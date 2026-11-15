import { AsyncLocalStorage } from "node:async_hooks";
import { PostgresRepository } from "../infrastructure/postgres/app/PostgresRepository";
import { Database, databasePool } from "../infrastructure/postgres/database";
import { AuthService } from "../application/auth/AuthService";
import { UserService } from "../application/users/UserService";
import { RecoveryService } from "../application/auth/RecoveryService";
import { MeasurementService } from "../application/measurements/MeasurementService";
import { TelemetryService } from "../application/measurements/TelemetryService";
import { AssessmentService } from "../application/assessment/AssessmentService";
import { HistoricalEnvironmentProvider } from "../infrastructure/environment/HistoricalEnvironmentProvider";
import { createPostgresAlertRepository } from "../infrastructure/postgres/app/alertRepository";
export function createServices(repo: PostgresRepository) {
 const auth = new AuthService(repo), assessments = new AssessmentService(repo);
 return { repo, auth, assessments, users: new UserService(repo, auth), recovery: new RecoveryService(repo,auth),
 telemetry: new TelemetryService(repo,auth), alerts: createPostgresAlertRepository(repo.db),
 measurements: new MeasurementService(repo,auth,new HistoricalEnvironmentProvider(repo),value=>assessments.preview(value)) };
}
const context = new AsyncLocalStorage<ReturnType<typeof createServices>>();
export function services() { const value=context.getStore();if(!value) throw new Error("Request context required");return value; }
export async function withServices<T>(work:()=>Promise<T>):Promise<T> {
 const client=await databasePool().connect();
 try {return await context.run(createServices(new PostgresRepository(new Database(client,process.env.NASA_DATABASE_SCHEMA ?? "app"))),work);} finally {client.release();}
}
