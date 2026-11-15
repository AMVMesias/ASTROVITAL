export type Role = "admin" | "astronauta";
export type Activity = "rest" | "exercise" | "eva";
export type Origin = "manual" | "device" | "simulated";
export type Indicator = "sleep" | "wellbeing" | "heart_rate";

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  enabled: boolean;
  requiresOnboarding: boolean;
  astronautId: string | null;
  missionId: string | null;
  moduleId: string | null;
  createdAt: string;
}
export interface Account extends User { passwordHash: string }
export interface Session extends User { sessionId: string; expiresAt: string }
export interface EnvironmentContext {
  scenarioId: string;
  profileId: string;
  profileVersion: string;
  scope: "cabin" | "exterior";
  assignmentId: string;
  telemetryAvailable: boolean;
}
/** Persona 2 implementa este puerto. Debe resolver el intervalo histórico, no el perfil actual. */
export interface EnvironmentProvider {
  resolve(astronautId: string, capturedAt: string): Promise<EnvironmentContext | null>;
}
export interface Measurement {
  id: string;
  astronautId: string;
  missionId: string;
  moduleId: string;
  indicator: Indicator;
  value: number;
  unit: string;
  origin: Origin;
  quality: "valid";
  capturedAt: string;
  receivedAt: string;
  authorId: string | null;
  deviceId: string | null;
  readingId: string | null;
  activity: Activity;
  note: string;
  scenario: string | null;
  environment: EnvironmentContext;
}
export interface Device {
  id: string;
  astronautId: string;
  enabled: boolean;
  lastCommunicationAt: string | null;
  signal?: { status:string; observedAt:string } | null;
}
export interface MeasurementQuery { indicator?: Indicator; from?: string; to?: string; limit: number; offset: number }
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message); }
}

/** Límites de formato del guion v1; no son umbrales clínicos ni reglas de aviso. */
export const indicatorConfig = {
  sleep: { label: "Sueño", unit: "h", min: 0, max: 24, integer: false },
  wellbeing: { label: "Bienestar", unit: "score_1_5", min: 1, max: 5, integer: true },
  heart_rate: { label: "Frecuencia cardíaca", unit: "bpm", min: 1, max: 300, integer: false },
} as const;
