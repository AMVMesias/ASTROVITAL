export type Reading = {
  id: string;
  indicator: "heart_rate" | "sleep" | "wellbeing";
  value: number;
  unit: string;
  capturedAt: string;
  origin: "manual" | "device" | "simulated";
  quality: "valid" | "invalid";
  activity?: "rest" | "exercise" | "eva" | "unknown";
  activityConfirmed?: boolean;
  deviceId?: string | null;
  maxAgeSeconds?: number;
};
export type Assessment = {
  measurementId: string;
  indicator: Reading["indicator"];
  status: "insufficient" | "invalid" | "stale" | "stable" | "deviation";
  ruleVersion: string;
  reference?: { mean: number; count: number };
  recommendation?: { message: { es: string; en: string } };
};
/** No value range, pulse value or absent context can confirm rest. */
export function readingContext(
  reading: Reading,
): NonNullable<Reading["activity"]> {
  return reading.activityConfirmed === true &&
    reading.activity &&
    ["rest", "exercise", "eva"].includes(reading.activity)
    ? reading.activity
    : "unknown";
}
export function readingFreshness(
  reading: Reading,
  now: number,
): "fresh" | "stale" | "unknown" {
  const captured = Date.parse(reading.capturedAt);
  if (
    !Number.isFinite(captured) ||
    captured > now ||
    !Number.isFinite(reading.maxAgeSeconds) ||
    reading.maxAgeSeconds! <= 0
  )
    return "unknown";
  return now - captured > reading.maxAgeSeconds! * 1000 ? "stale" : "fresh";
}
export function readingAssessment(
  reading: Reading,
  assessments: Assessment[],
): Assessment | undefined {
  return assessments.find(
    (result) =>
      result.measurementId === reading.id &&
      result.indicator === reading.indicator,
  );
}
