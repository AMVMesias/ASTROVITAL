import type { EnvironmentReference } from "../contracts/mvp";

type VerifiedSession =
  | { role: "admin" }
  | { role: "astronauta"; astronautId: string; missionId: string };

interface EnvironmentAssignmentWriter {
  assign(missionId: string, astronautId: string, effectiveFrom: string, reference: EnvironmentReference): Promise<boolean>;
}

// El adaptador de acceso verifica la sesión antes de invocar este caso de uso.
export async function selectEnvironment(
  assignments: EnvironmentAssignmentWriter,
  session: VerifiedSession,
  reference: EnvironmentReference,
  now: Date,
): Promise<"selected" | "forbidden" | "not_assigned"> {
  if (session.role !== "astronauta") return "forbidden";

  return (await assignments.assign(session.missionId, session.astronautId, now.toISOString(), reference))
    ? "selected"
    : "not_assigned";
}
