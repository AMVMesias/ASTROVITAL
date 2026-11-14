export type PersonalMeasurement = {
  id: string;
  astronautId: string;
  missionId: string;
  indicator: string;
  unit: string;
  value: number;
  capturedAt: string;
  quality: "valid" | "invalid";
  origin: "manual" | "sensor" | "simulado";
  activity?: string;
  environment: { scenarioId: string; revision: string };
};

export type AssessmentRule = {
  version: string;
  referenceWindowMs: number;
  maxAgeMs: number;
  minimumSamples: number;
  consecutiveSamples: number;
  absoluteDeviation: number;
};

export type Reference = { mean: number; count: number; from: string; to: string };
export type Assessment = {
  status: "insufficient" | "invalid" | "stale" | "stable" | "deviation";
  ruleVersion: string;
  evidence: string[];
  reference?: Reference;
};

export function validateAssessmentRule(rule: AssessmentRule) {
  if (![rule.referenceWindowMs, rule.maxAgeMs, rule.minimumSamples, rule.consecutiveSamples].every(
    (value) => Number.isSafeInteger(value) && value > 0,
  ) || !Number.isFinite(rule.absoluteDeviation) || rule.absoluteDeviation <= 0 || !rule.version.trim()) {
    throw new Error("Regla de evaluación inválida");
  }
}

export function assessMeasurements(
  latest: PersonalMeasurement,
  history: readonly PersonalMeasurement[],
  rule: AssessmentRule,
  now: Date,
): Assessment {
  validateAssessmentRule(rule);
  const { referenceWindowMs, maxAgeMs, minimumSamples, consecutiveSamples, absoluteDeviation } = rule;

  const targetTime = Date.parse(latest.capturedAt);
  const currentTime = now.getTime();
  if (!Number.isFinite(currentTime)) throw new Error("Reloj de evaluación inválido");

  const result: Assessment = { status: "insufficient", ruleVersion: rule.version, evidence: [latest.id] };
  if (!Number.isFinite(targetTime) || targetTime > currentTime ||
      latest.quality !== "valid" || !Number.isFinite(latest.value)) {
    return { ...result, status: "invalid" };
  }
  if (currentTime - targetTime > maxAgeMs) return { ...result, status: "stale" };

  const from = targetTime - referenceWindowMs;
  const unique = new Map<string, PersonalMeasurement>();
  for (const entry of history) {
    const time = Date.parse(entry.capturedAt);
    if (entry.id !== latest.id && entry.astronautId === latest.astronautId &&
        entry.missionId === latest.missionId && entry.indicator === latest.indicator &&
        entry.unit === latest.unit && entry.activity === latest.activity &&
        entry.environment.scenarioId === latest.environment.scenarioId &&
        entry.environment.revision === latest.environment.revision &&
        (entry.origin === "simulado") === (latest.origin === "simulado") &&
        time >= from && time < targetTime) {
      unique.set(entry.id, entry);
    }
  }

  const ordered = [...unique.values()].sort(
    (a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt) || a.id.localeCompare(b.id),
  );
  const baselineEnd = ordered.length - consecutiveSamples + 1;
  if (baselineEnd < minimumSamples) return result;
  const recent = [...ordered.slice(baselineEnd), latest];
  const baseline = ordered.slice(0, baselineEnd).filter(
    (entry) => entry.quality === "valid" && Number.isFinite(entry.value),
  );
  if (recent.length !== consecutiveSamples || baseline.length < minimumSamples) return result;

  const mean = baseline.reduce((sum, entry) => sum + entry.value / baseline.length, 0);
  const reference = {
    mean, count: baseline.length, from: baseline[0].capturedAt, to: baseline[baseline.length - 1].capturedAt,
  };
  const deviations = recent.map((entry) => entry.value - mean);
  const sustained = recent.every((entry) => entry.quality === "valid" && Number.isFinite(entry.value)) &&
    (deviations.every((delta) => delta >= absoluteDeviation) ||
      deviations.every((delta) => delta <= -absoluteDeviation));

  return {
    ...result,
    status: sustained ? "deviation" : "stable",
    reference,
    evidence: recent.map(({ id }) => id),
  };
}
