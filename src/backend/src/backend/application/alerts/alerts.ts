import type { Assessment, PersonalMeasurement } from "../assessment/assessMeasurements";

export type Alert = {
  id: string;
  measurementId: string;
  missionId: string;
  astronautId: string;
  status: "open" | "tracking" | "closed";
  kind: "quality" | "variation";
  reason: "invalid" | "stale" | "deviation";
  evidence: Assessment;
  createdAt: string;
};

export type AlertAction = {
  authorId: string;
  type: "observation" | "repeat" | "track" | "close";
  note?: string;
  createdAt: string;
};

export type AlertOwner = { missionId: string; astronautId: string };

export type AlertSession =
  | { role: "admin" }
  | ({ role: "astronauta"; userId: string } & AlertOwner);

export interface AlertRepository {
  insert(alert: Alert): Alert;
  list(owner: AlertOwner): Alert[];
  detail(owner: AlertOwner, alertId: string): { alert: Alert; actions: AlertAction[] } | undefined;
  act(owner: AlertOwner, alertId: string, action: AlertAction): "recorded" | "not_found" | "closed";
}

export function recordAssessment(
  repository: AlertRepository,
  measurement: PersonalMeasurement,
  assessment: Assessment,
  now: Date,
): Alert | undefined {
  const reason = assessment.status;
  if (reason !== "invalid" && reason !== "stale" && reason !== "deviation") return;

  return repository.insert({
    id: JSON.stringify([measurement.missionId, measurement.astronautId, measurement.id, assessment.ruleVersion, reason]),
    measurementId: measurement.id,
    missionId: measurement.missionId,
    astronautId: measurement.astronautId,
    status: "open",
    kind: reason === "deviation" ? "variation" : "quality",
    reason,
    evidence: assessment,
    createdAt: now.toISOString(),
  });
}

export function createAstronautAlerts(repository: AlertRepository, session: AlertSession) {
  if (session.role !== "astronauta") return undefined;

  return {
    list: () => repository.list(session),
    detail: (id: string) => repository.detail(session, id),
    act(id: string, type: AlertAction["type"], note: string | undefined, now: Date) {
      const normalizedNote = note?.trim();
      if (normalizedNote && normalizedNote.length > 1000) return "invalid_note";
      return repository.act(session, id, {
        type, note: normalizedNote || undefined, authorId: session.userId, createdAt: now.toISOString(),
      });
    },
  };
}
