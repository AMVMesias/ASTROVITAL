import type { EnvironmentProvider } from "../../domain/model";
import type { SqliteRepository } from "../sqlite/SqliteRepository";
import { createSqliteEnvironmentRepository } from "../sqlite/environmentRepository";

export class HistoricalEnvironmentProvider implements EnvironmentProvider {
  constructor(private repo: SqliteRepository) {}
  resolve(astronautId: string, capturedAt: string) {
    const astronaut=this.repo.get("SELECT mission_id FROM astronauts WHERE id=?",astronautId);
    if(!astronaut) return null;
    const repository=createSqliteEnvironmentRepository(this.repo.db);
    const assignment=repository.findAt(String(astronaut.mission_id),astronautId,capturedAt);
    if(!assignment) return null;
    return { scenarioId:assignment.reference.scenarioId, profileId:assignment.reference.scenarioId,
      profileVersion:assignment.reference.revision,
      assignmentId:JSON.stringify([astronaut.mission_id,astronautId,assignment.effectiveFrom]),
      scope: (["moon_surface","mars_surface"].includes(assignment.reference.scenarioId) ? "exterior" : "cabin") as "exterior"|"cabin",
      telemetryAvailable:false };
  }
}
