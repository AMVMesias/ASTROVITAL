import type { AlertRepository } from "../alerts/alerts";
import { recordAssessment } from "../alerts/alerts";
import type { Indicator, Measurement, MeasurementQuery } from "../../domain/model";
import { assessMeasurements, type AssessmentRule, type PersonalMeasurement } from "./assessMeasurements";

const day = 86_400_000;
const demoRules: Record<Indicator, AssessmentRule> = {
  heart_rate: { version: "demo-pulse-1", referenceWindowMs: 14 * day, maxAgeMs: 300_000,
    minimumSamples: 3, consecutiveSamples: 2, absoluteDeviation: 10 },
  sleep: { version: "demo-sleep-1", referenceWindowMs: 14 * day, maxAgeMs: 2 * day,
    minimumSamples: 3, consecutiveSamples: 2, absoluteDeviation: 1.5 },
  wellbeing: { version: "demo-wellbeing-1", referenceWindowMs: 14 * day, maxAgeMs: 2 * day,
    minimumSamples: 3, consecutiveSamples: 2, absoluteDeviation: 1 },
};

function forAssessment(reading: Measurement): PersonalMeasurement {
  return {
    ...reading,
    origin: reading.origin === "simulated" ? "simulado" : reading.origin === "device" ? "sensor" : "manual",
    environment: { scenarioId: reading.environment.scenarioId, revision: reading.environment.profileVersion },
  };
}

export function createMeasurementAssessment(
  history: (astronautId: string, query: MeasurementQuery) => Measurement[],
  alerts: AlertRepository,
) {
  function evaluate(reading: Measurement, now: Date) {
    const rule = demoRules[reading.indicator];
    const timestamp = Date.parse(reading.capturedAt);
    const recent: PersonalMeasurement[] = [];
    if (timestamp <= now.getTime() && now.getTime() - timestamp <= rule.maxAgeMs) {
      const query = {
        indicator: reading.indicator,
        from: new Date(timestamp - rule.referenceWindowMs).toISOString(),
        to: new Date(timestamp - 1).toISOString(),
        limit: 200,
        offset: 0,
      };
      for (;;) {
        const page = history(reading.astronautId, query);
        recent.push(...page.map(forAssessment));
        if (page.length < query.limit) break;
        query.offset += query.limit;
      }
    }
    return assessMeasurements(forAssessment(reading), recent, rule, now);
  }

  return {
    evaluate,
    record(reading: Measurement) {
      // Evaluar la tendencia en el momento de la lectura. El resumen comprueba vigencia con el reloj actual.
      const outcome = evaluate(reading, new Date(reading.capturedAt));
      recordAssessment(alerts, forAssessment(reading), outcome, new Date(reading.receivedAt));
    },
  };
}
