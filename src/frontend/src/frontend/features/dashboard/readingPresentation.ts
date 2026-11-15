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
  reading: Pick<Reading,"capturedAt"|"maxAgeSeconds">,
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

export type SensorSnapshot = {
  deviceId: string; capturedAt: string; maxAgeSeconds?: number;
  sensors: { ecg?: {state:number; bpm:number|null}; oximeter: {spo2:number|null}; respiration:{rpm:number|null} };
};
export function currentPulseStatus(reading:Reading|undefined, signal:{status:string;observedAt:string}|null|undefined, snapshot:SensorSnapshot|undefined, now:number) {
  const time=reading ? Date.parse(reading.capturedAt) : -Infinity;
  if(signal && Date.parse(signal.observedAt)>=time && signal.status==="disconnected") return "disconnected";
  if(snapshot && Date.parse(snapshot.capturedAt)>=time && readingFreshness(snapshot,now)==="fresh") {
    if(snapshot.sensors.ecg?.state===0) return "no_contact";
    if(snapshot.sensors.ecg?.state===1) return "no_signal";
    if(snapshot.sensors.ecg?.bpm===null) return "insufficient";
  }
  if(signal && Date.parse(signal.observedAt)>=time && ["no_contact","no_signal","insufficient"].includes(signal.status)) return signal.status;
  if(!reading) return "missing";
  if(reading.quality!=="valid") return "invalid";
  return readingFreshness(reading,now)==="fresh" ? "live" : "stale";
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
