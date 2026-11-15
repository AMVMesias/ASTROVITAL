import type { EnvironmentContext, EnvironmentProvider } from "../../domain/model";
import type { EnvironmentAtCapture } from "../contracts/mvp";
import type { EnvironmentCatalog } from "./environment";

export function createMissionEnvironment(
  catalog: EnvironmentCatalog,
  assignments: EnvironmentAtCapture,
  missionFor: (astronautId: string) => string | undefined,
): EnvironmentProvider {
  return {
    async resolve(astronautId, capturedAt): Promise<EnvironmentContext | null> {
      const missionId = missionFor(astronautId);
      if (!missionId) return null;
      const assignment = await assignments.findAt(missionId, astronautId, capturedAt);
      const scenarioId = assignment?.reference.scenarioId ?? "iss_leo";

      return {
        scenarioId,
        profileId: scenarioId,
        profileVersion: assignment?.reference.revision ?? catalog.revision,
        scope: scenarioId === "moon_surface" || scenarioId === "mars_surface" ? "exterior" : "cabin",
        assignmentId: assignment ? `${astronautId}:${assignment.effectiveFrom}` : `default:${astronautId}`,
        telemetryAvailable: false,
      };
    },
  };
}
