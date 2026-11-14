export type EnvironmentReference = {
  scenarioId: string;
  revision: string;
};

export type EnvironmentAssignment = {
  reference: EnvironmentReference;
  effectiveFrom: string;
  effectiveTo: string | null;
};

// Propuesta para el adaptador de captura. Las claves provienen de la sesión o del dispositivo autorizado.
export interface EnvironmentAtCapture {
  findAt(missionId: string, astronautId: string, capturedAt: string): EnvironmentAssignment | undefined;
}
