import type { EnvironmentContext, EnvironmentProvider } from "../../domain/model";

/** Adaptador provisional de preparación, explícito y sin telemetría.
 * Persona 2 sustituye este puerto por asignaciones históricas persistidas.
 * No importa ni convierte referencias documentales en lecturas.
 */
export class PreparationEnvironmentProvider implements EnvironmentProvider {
  resolve(astronautId: string, _capturedAt: string): EnvironmentContext {
    void _capturedAt;
    return { scenarioId: "iss_leo", profileId: "preparation-iss-cabin", profileVersion: "preparation-1",
      assignmentId: `preparation:${astronautId}`, scope: "cabin", telemetryAvailable: false };
  }
}
