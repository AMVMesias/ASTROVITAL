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
  direction?: "above"|"below";
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
  deviceId: string; readingId?:string; capturedAt: string; maxAgeSeconds?: number;
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

export type SensorDecision = {
 timestamp:string;
 telemetry:{latestAt:string|null;lastReadingId:string|null;deviceId?:string|null;indicators:{key:string;value:number|null;quality:string;alertLevel?:"review"|"priority"|null}[]};
};
/** Never carry a red warning onto another snapshot, device, stale or absent value. */
export function sensorHasAlert(snapshot:SensorSnapshot|undefined,decision:SensorDecision|null|undefined,key:string,now:number):boolean {
 if(!snapshot||!decision||readingFreshness(snapshot,now)!=="fresh")return false;
 if(snapshot.readingId!==decision.telemetry.lastReadingId||snapshot.deviceId!==decision.telemetry.deviceId||snapshot.capturedAt!==decision.telemetry.latestAt)return false;
 const calculated=Date.parse(decision.timestamp);
 if(!Number.isFinite(calculated)||calculated>now||now-calculated>30000)return false;
 const indicator=decision.telemetry.indicators.find(value=>value.key===key);
 return indicator?.quality==="valid"&&indicator.value!==null&&!!indicator.alertLevel;
}
