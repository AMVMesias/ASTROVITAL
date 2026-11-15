import type { AlertRepository } from "../alerts/alerts";
import { recordAssessment } from "../alerts/alerts";
import { assessMeasurements, validateAssessmentRule } from "./assessMeasurements";
import type { AssessmentRule, PersonalMeasurement } from "./assessMeasurements";

export interface AssessmentHistory {
  list(input: {
    missionId: string;
    astronautId: string;
    indicator: string;
    from: string;
    before: string;
  }): Promise<readonly PersonalMeasurement[]>;
}

// Capture can rerun this after an interrupted evaluation using the same persisted ID.
export async function evaluatePersistedMeasurement(
  history: AssessmentHistory,
  alerts: AlertRepository,
  measurement: PersonalMeasurement,
  rule: AssessmentRule,
  now: Date,
) {
  validateAssessmentRule(rule);
  const capturedAt = Date.parse(measurement.capturedAt);
  const past = Number.isFinite(capturedAt) && capturedAt <= now.getTime() &&
      now.getTime() - capturedAt <= rule.maxAgeMs &&
      measurement.quality === "valid" && Number.isFinite(measurement.value)
    ? await history.list({
        missionId: measurement.missionId,
        astronautId: measurement.astronautId,
        indicator: measurement.indicator,
        from: new Date(capturedAt - rule.referenceWindowMs).toISOString(),
        before: measurement.capturedAt,
      })
    : [];
  const assessment = assessMeasurements(measurement, past, rule, now);
  return { assessment, alert: (await recordAssessment(alerts, measurement, assessment, now)) };
}
