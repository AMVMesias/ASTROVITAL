"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useLanguage } from "../../providers/LanguageProvider";
import { AdminIcon } from "../../components/ui/AdminIcon";
import {
  readingAssessment,
  readingContext,
  readingFreshness,
  currentPulseStatus,
  type SensorSnapshot,
  type Reading,
  type Assessment,
} from "./readingPresentation";
import { VitalTrend, type TrendSeries } from "./VitalTrend";
import styles from "./dashboard.module.css";

type Device = {
  id: string;
  lastCommunicationAt: string | null;
  signal?: { status: string; observedAt: string } | null;
};
type Summary = {
  latest: Reading[];
  evaluation: Assessment[];
  devices: Device[];
};
type Alert = {
  id: string;
  measurementId: string;
  status: string;
  reason: Assessment["status"];
  evidence: Assessment;
};
type Telemetry = SensorSnapshot;
type DashboardData = {
  summary: Summary;
  alerts: Alert[];
  history: Reading[] | null;
  telemetry: Telemetry[] | null;
  latestTelemetry: Telemetry | undefined;
};
async function loadDashboard(): Promise<DashboardData> {
  const from = new Date(Date.now() - 86400000).toISOString();
  const options = { cache: "no-store" } as const;
  const [summary, notices, history, telemetry, latestTelemetry] = await Promise.all([
    api<Summary>("/v1/me/measurements/latest", options),
    api<{ alerts: Alert[] }>("/v1/me/alerts", options),
    api<{ measurements: Reading[] }>(
      `/v1/me/measurements?indicator=heart_rate&from=${encodeURIComponent(from)}&limit=200`,
      options,
    ).catch(() => null),
    api<{ samples: Telemetry[] }>(
      `/v1/me/telemetry?from=${encodeURIComponent(from)}&limit=200`,
      options,
    ).catch(() => null),
    api<{samples:Telemetry[]}>("/v1/me/telemetry/latest",options).catch(()=>null),
  ]);
  return {
    summary,
    alerts: notices.alerts,
    history: history?.measurements ?? null,
    telemetry: telemetry?.samples ?? null,
    latestTelemetry: latestTelemetry?.samples[0],
  };
}
export function MissionDashboard() {
  const { locale } = useLanguage();
  const es = locale === "es";
  const [data, setData] = useState<DashboardData>();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const requestSequence=useRef(0);
  async function refresh() {
    const sequence=++requestSequence.current;
    setPending(true);
    try {
      const result=await loadDashboard();
      if(sequence!==requestSequence.current)return;
      setData(result);
      setNow(Date.now());
      setError(false);
    } catch {
      if(sequence===requestSequence.current)setError(true);
    } finally {
      setPending(false);
    }
  }
  useEffect(() => {
    let active = true;
    async function load() {
      const sequence=++requestSequence.current;
      try {
        const result = await loadDashboard();
        if (active && sequence===requestSequence.current) {
          setData(result);
          setError(false);
          setNow(Date.now());
        }
      } catch {
        if (active && sequence===requestSequence.current) setError(true);
      }
    }
    void load();
    let lastCaptureRefresh = 0;
    const onCapture = () => {
      if (Date.now() - lastCaptureRefresh < 5000) return;
      lastCaptureRefresh = Date.now();
      void load();
    };
    window.addEventListener("astrovital:measurement", onCapture);
    const clock=setInterval(()=>setNow(Date.now()),1000);
    const timer = setInterval(() => {
      if (active) {
        setNow(Date.now());
        void load();
      }
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
      clearInterval(clock);
      window.removeEventListener("astrovital:measurement", onCapture);
    };
  }, []);
  const readings = data?.summary.latest ?? [];
  const evaluations = Array.isArray(data?.summary.evaluation)
    ? data.summary.evaluation
    : [];
  const heart = readings.find((r) => r.indicator === "heart_rate");
  const heartAssessment = heart
    ? readingAssessment(heart, evaluations)
    : undefined;
  const context = heart ? readingContext(heart) : "unknown";
  const freshness = heart ? readingFreshness(heart, now) : "unknown";
  const contexts = es
    ? {
        rest: "En reposo",
        exercise: "Ejercicio",
        eva: "EVA",
        unknown: "No confirmado",
      }
    : {
        rest: "At rest",
        exercise: "Exercise",
        eva: "EVA",
        unknown: "Unconfirmed",
      };
  const states = es
    ? {
        insufficient: "Datos insuficientes",
        invalid: "Lectura inválida",
        stale: "Lectura desactualizada",
        stable: "Sin desviación detectada",
        deviation: "Desviación sostenida",
      }
    : {
        insufficient: "Insufficient data",
        invalid: "Invalid reading",
        stale: "Stale reading",
        stable: "No deviation detected",
        deviation: "Sustained deviation",
      };
  const heartState =
    heart?.quality === "invalid"
      ? "invalid"
      : freshness === "stale"
        ? "stale"
        : context !== "rest"
          ? "insufficient"
          : (heartAssessment?.status ?? "insufficient");
  const selectedDeviceId=data?.latestTelemetry && (!heart || Date.parse(data.latestTelemetry.capturedAt)>=Date.parse(heart.capturedAt)) ? data.latestTelemetry.deviceId : heart?.deviceId;
  const device =
    data?.summary.devices?.find((d) => d.id === selectedDeviceId) ??
    data?.summary.devices?.[0];
  const telemetry =
    data?.telemetry?.filter(
      (t) => !selectedDeviceId || t.deviceId === selectedDeviceId,
    ) ?? [];
  const recentSnapshot=data?.latestTelemetry;
  const latestTelemetry=recentSnapshot?.deviceId===selectedDeviceId ? recentSnapshot : undefined;
  const telemetryDisconnected=device?.signal?.status==="disconnected" && latestTelemetry && Date.parse(device.signal.observedAt)>=Date.parse(latestTelemetry.capturedAt);
  const telemetryFresh=latestTelemetry && !telemetryDisconnected && readingFreshness(latestTelemetry,now)==="fresh";
  const matchingHeart=heart?.origin!=="device" || heart.deviceId===selectedDeviceId ? heart : undefined;
  const pulseStatus=currentPulseStatus(matchingHeart,device?.signal,latestTelemetry,now);
  const pulseLabels:Record<string,string>=es ? {no_contact:"Sin contacto",no_signal:"Sin señal",insufficient:"Sin pulso válido",disconnected:"Desconectado",stale:"Lectura desactualizada",invalid:"Lectura inválida",missing:"Sin lectura"} : {no_contact:"No contact",no_signal:"No signal",insufficient:"No valid pulse",disconnected:"Disconnected",stale:"Stale reading",invalid:"Invalid reading",missing:"No reading"};
  const activeAlerts = data?.alerts.filter((a) => a.status !== "closed") ?? [];
  const series: TrendSeries[] = [
    {
      name: "SpO₂",
      unit: "%",
      color: "#0075ff",
      points: telemetry.flatMap((t) =>
        t.sensors?.oximeter?.spo2 == null
          ? []
          : [{ time: t.capturedAt, value: t.sensors.oximeter.spo2 }],
      ),
    },
    {
      name:
        heart?.origin === "simulated"
          ? es
            ? "FC (sim.)"
            : "HR (sim.)"
          : es
            ? "FC"
            : "HR",
      unit: "lpm",
      color: "#f21f32",
      points: (data?.history ?? [])
        .filter(
          (r) =>
            r.indicator === "heart_rate" &&
            (r.origin === "simulated") === (heart?.origin === "simulated") &&
            r.quality === "valid" &&
            r.unit === "bpm",
        )
        .map((r) => ({ time: r.capturedAt, value: r.value })),
    },
    {
      name: es ? "Resp." : "Resp.",
      unit: "rpm",
      color: "#8534ed",
      points: telemetry.flatMap((t) =>
        t.sensors?.respiration?.rpm == null
          ? []
          : [{ time: t.capturedAt, value: t.sensors.respiration.rpm }],
      ),
    },
  ];
  const formatTime = (time: string) => new Date(time).toLocaleString(locale);
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>
            ASTROVITAL <span />
          </p>
          <h1>{es ? "Resumen de mi salud" : "My health overview"}</h1>
          <p className={styles.subtitle}>
            {es
              ? "Estado actual, tendencias y avisos de tus indicadores."
              : "Current status, trends and alerts for your indicators."}
          </p>
        </div>
        <button
          className={styles.refresh}
          disabled={pending}
          onClick={() => void refresh()}
        >
          {pending
            ? es
              ? "Actualizando…"
              : "Refreshing…"
            : es
              ? "Actualizar"
              : "Refresh"}
        </button>
      </header>
      {error && (
        <p role="alert" className={styles.warning}>
          {es
            ? "No se pudo actualizar. Se conserva la última consulta; la conexión no está verificada."
            : "Refresh failed. Last fetched data is retained; connection unverified."}
        </p>
      )}
      {!data && !error && (
        <p role="status">
          {es ? "Cargando mediciones…" : "Loading measurements…"}
        </p>
      )}
      {data && (
        <div className={styles.dashboardGrid}>
          <section className={`${styles.panel} ${styles.vitals}`}>
            <div className={styles.sectionHeading}>
              <h2>
                <AdminIcon name="pulse" />
                {es ? "Signos vitales (sensores)" : "Vital signs (sensors)"}
              </h2>
              <span className={styles.neutralBadge}>
                {es ? "Últimas lecturas" : "Latest readings"}
              </span>
            </div>
            <div className={styles.vitalCards}>
              <article
                className={styles.vitalCard}
                aria-label={es ? "Frecuencia cardíaca" : "Heart rate"}
              >
                <h3>
                  <span className={styles.red}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0L12 5.5l-.9-.9a5.6 5.6 0 1 0-7.9 7.9L12 21l8.8-8.5a5.6 5.6 0 0 0 0-7.9Z" />
                    </svg>
                  </span>
                  {es ? "Frecuencia cardíaca" : "Heart rate"}
                </h3>
                <p className={styles.value}>
                  {pulseStatus==="live" ? heart?.value : "—"}
                  <span>lpm</span>
                </p>
                <span
                  className={
                    pulseStatus==="live" && heartState === "stable"
                      ? styles.goodBadge
                      : styles.neutralBadge
                  }
                >
                  {pulseStatus!=="live" ? pulseLabels[pulseStatus] : heart
                    ? states[heartState]
                    : es
                      ? "Sin lectura"
                      : "No reading"}
                </span>
                <p className={styles.timestamp}>
                  {heart ? (
                    <time dateTime={heart.capturedAt}>
                      {es ? "Última válida: " : "Last valid: "}{heart.value} lpm · {formatTime(heart.capturedAt)}
                    </time>
                  ) : es ? (
                    "Sin mediciones registradas"
                  ) : (
                    "No measurements recorded"
                  )}
                </p>
              </article>
              {[
                {
                  name: es ? "Oxigenación (SpO₂)" : "Oxygenation (SpO₂)",
                  icon: "droplet",
                  value: latestTelemetry?.sensors?.oximeter?.spo2,
                  unit: "%",
                  color: styles.blue,
                },
                {
                  name: es ? "Respiración" : "Respiration",
                  icon: "lungs",
                  value: latestTelemetry?.sensors?.respiration?.rpm,
                  unit: "rpm",
                  color: styles.purple,
                },
              ].map((item) => (
                <article key={item.icon} className={styles.vitalCard}>
                  <h3>
                    <span className={item.color}>
                      <AdminIcon name={item.icon} />
                    </span>
                    {item.name}
                  </h3>
                  <p className={styles.value}>
                    {telemetryFresh ? item.value ?? "—" : "—"}
                    <span>{item.unit}</span>
                  </p>
                  <span className={styles.neutralBadge}>
                    {telemetryDisconnected ? (es ? "Desconectado" : "Disconnected") : latestTelemetry && !telemetryFresh ? (es ? "Lectura desactualizada" : "Stale reading") : item.value == null
                      ? es
                        ? "Sin lectura válida"
                        : "No valid reading"
                      : es
                        ? "Telemetría sin evaluación"
                        : "Unassessed telemetry"}
                  </span>
                  <p className={styles.timestamp}>
                    {latestTelemetry ? (
                      <time dateTime={latestTelemetry.capturedAt}>
                        {formatTime(latestTelemetry.capturedAt)}
                      </time>
                    ) : es ? (
                      "Sin datos del sensor"
                    ) : (
                      "No sensor data"
                    )}
                  </p>
                </article>
              ))}
            </div>
            <div className={styles.heartContext}>
              <dl>
                <div>
                  <dt>{es ? "Actividad de última medición" : "Last measurement activity"}</dt>
                  <dd>{contexts[context]}</dd>
                </div>
                <div>
                  <dt>
                    {es
                      ? "Referencia personal en reposo"
                      : "Personal resting reference"}
                  </dt>
                  <dd>
                    {heartAssessment?.reference
                      ? `${heartAssessment.reference.mean.toFixed(1)} lpm · ${heartAssessment.reference.count} ${es ? "muestras" : "samples"}`
                      : es
                        ? "Referencia insuficiente"
                        : "Insufficient baseline"}
                  </dd>
                </div>
                <div>
                  <dt>{es ? "Origen · Calidad de última medición" : "Last measurement source · Quality"}</dt>
                  <dd>
                    {heart
                      ? `${heart.origin === "device" ? "ESP32" : heart.origin === "simulated" ? (es ? "Simulado" : "Simulated") : "Manual"} · ${heart.quality === "valid" ? (es ? "Válida" : "Valid") : es ? "Inválida" : "Invalid"}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{es ? "Vigencia" : "Freshness"}</dt>
                  <dd>
                    {pulseStatus!=="live" ? pulseLabels[pulseStatus] : freshness === "fresh"
                      ? es
                        ? "Lectura vigente"
                        : "Fresh reading"
                      : freshness === "stale"
                        ? es
                          ? "Desactualizada"
                          : "Stale"
                        : es
                          ? "No verificada"
                          : "Unverified"}
                  </dd>
                </div>
              </dl>
              {heart && context !== "rest" && (
                <p>
                  {es
                    ? "La última medición no está confirmada como frecuencia cardíaca en reposo."
                    : "The last measurement is not confirmed as a resting heart rate."}
                </p>
              )}
            </div>
          </section>
          <section className={`${styles.panel} ${styles.evaluation}`}>
            <div className={styles.sectionHeading}>
              <h2>
                <AdminIcon name="shield" />
                {es ? "Evaluación actual" : "Current assessment"}
              </h2>
            </div>
            <div
              className={`${styles.evaluationBox} ${pulseStatus==="live" && heartState === "stable" ? styles.stable : ""}`}
            >
              <AdminIcon name={pulseStatus==="live" && heartState === "stable" ? "check" : "pulse"} />
              <div>
                <h3>
                  {pulseStatus!=="live" ? pulseLabels[pulseStatus] : heart
                    ? states[heartState]
                    : es
                      ? "Esperando lecturas"
                      : "Awaiting readings"}
                </h3>
                <p>
                  {pulseStatus!=="live" ? (es ? "No hay pulso actual válido para evaluar. Revisa los sensores y la conexión." : "No valid current pulse to assess. Check the sensors and connection.") : heartState === "stable"
                    ? es
                      ? "Sin desviación detectada en la frecuencia cardíaca en reposo respecto a tu referencia personal."
                      : "No resting heart-rate deviation detected against your personal reference."
                    : (heartAssessment?.recommendation?.message[
                        es ? "es" : "en"
                      ] ??
                      (es
                        ? "Se necesita contexto de reposo confirmado y muestras válidas suficientes para evaluar la frecuencia cardíaca en reposo."
                        : "Confirmed resting context and enough valid samples are needed to assess resting heart rate."))}
                </p>
              </div>
            </div>
            <p className={styles.rule}>
              {heartAssessment?.ruleVersion ??
                (es
                  ? "Evaluación de reposo pendiente"
                  : "Resting assessment pending")}
            </p>
          </section>
          <section className={`${styles.panel} ${styles.trend}`}>
            <div className={styles.sectionHeading}>
              <h2>
                <AdminIcon name="chart" />
                {es ? "Tendencia de signos vitales" : "Vital signs trend"}
              </h2>
              <span className={styles.period}>
                {es ? "Últimas 24 horas" : "Last 24 hours"}
              </span>
            </div>
            {data.history === null && data.telemetry === null ? (
              <p className={styles.chartEmpty}>
                {es
                  ? "Historial no disponible. Vuelve a actualizar."
                  : "History unavailable. Try refreshing."}
              </p>
            ) : (
              <VitalTrend series={series} now={now} locale={locale} />
            )}
            <p className={styles.chartNote}>
              {es
                ? "Hasta 200 muestras por origen. Unidades por serie; sin interpolar valores ausentes."
                : "Up to 200 samples per source. Units per series; absent values are not interpolated."}
            </p>
          </section>
          <section className={`${styles.panel} ${styles.alerts}`}>
            <div className={styles.sectionHeading}>
              <h2>
                <AdminIcon name="bell" />
                {es ? "Avisos" : "Alerts"}
              </h2>
              <span
                className={
                  activeAlerts.length ? styles.alertBadge : styles.neutralBadge
                }
              >
                {activeAlerts.length}{" "}
                {es
                  ? activeAlerts.length === 1
                    ? "activo"
                    : "activos"
                  : "active"}
              </span>
            </div>
            {activeAlerts.length ? (
              activeAlerts.slice(0, 2).map((alert) => (
                <Link key={alert.id} className={styles.notice} href="/avisos">
                  <AdminIcon name="bell" />
                  <div>
                    <h3>
                      {states[alert.reason] ??
                        (es ? "Aviso de salud" : "Health alert")}
                    </h3>
                    <p>
                      {alert.evidence?.recommendation?.message[
                        es ? "es" : "en"
                      ] ??
                        (es
                          ? "Revisa la evidencia y registra un seguimiento."
                          : "Review the evidence and record a follow-up.")}
                    </p>
                  </div>
                  <AdminIcon name="chevron" />
                </Link>
              ))
            ) : (
              <div className={styles.noAlerts}>
                <AdminIcon name="check" />
                <p>{es ? "No tienes avisos activos." : "No active alerts."}</p>
              </div>
            )}
          </section>
          <div className={styles.bottomCards}>
            {(["sleep", "wellbeing"] as const).map((indicator) => {
              const reading = readings.find((r) => r.indicator === indicator);
              const assessment = reading
                ? readingAssessment(reading, evaluations)
                : undefined;
              return (
                <section key={indicator} className={styles.panel}>
                  <div className={styles.sectionHeading}>
                    <h2>
                      <AdminIcon
                        name={indicator === "sleep" ? "moon" : "smile"}
                      />
                      {indicator === "sleep"
                        ? es
                          ? "Sueño"
                          : "Sleep"
                        : es
                          ? "Bienestar"
                          : "Wellbeing"}
                    </h2>
                    <span className={styles.neutralBadge}>
                      {assessment
                        ? states[assessment.status]
                        : es
                          ? "Sin evaluación"
                          : "Unassessed"}
                    </span>
                  </div>
                  <p className={styles.value}>
                    {reading ? reading.value : "—"}
                    <span>{indicator === "sleep" ? "h" : "/5"}</span>
                  </p>
                  <p className={styles.bottomReference}>
                    {assessment?.reference
                      ? `${es ? "Ref. personal" : "Personal ref."}: ${assessment.reference.mean.toFixed(1)} ${indicator === "sleep" ? "h" : "/5"}`
                      : es
                        ? "Referencia insuficiente"
                        : "Insufficient baseline"}
                  </p>
                  {reading && (
                    <time
                      className={styles.timestamp}
                      dateTime={reading.capturedAt}
                    >
                      {formatTime(reading.capturedAt)}
                    </time>
                  )}
                </section>
              );
            })}
            <section className={styles.panel}>
              <div className={styles.sectionHeading}>
                <h2>
                  <AdminIcon name="chip" />
                  {es ? "Dispositivo (ESP32)" : "Device (ESP32)"}
                </h2>
              </div>
              <span className={styles.neutralBadge}>
                {device
                  ? es
                    ? "Conexión no verificada"
                    : "Connection unverified"
                  : es
                    ? "Sin dispositivo vinculado"
                    : "No linked device"}
              </span>
              <p className={styles.bottomReference}>
                {es ? "Última comunicación" : "Last communication"}:{" "}
                {device?.lastCommunicationAt
                  ? formatTime(device.lastCommunicationAt)
                  : "—"}
              </p>
              {device?.signal && (
                <p className={styles.timestamp}>
                  {es ? "Señal" : "Signal"}: {device.signal.status} ·{" "}
                  {formatTime(device.signal.observedAt)}
                </p>
              )}
            </section>
          </div>
        </div>
      )}
      <footer className={styles.footer}>
        <p>
          {es
            ? "Evaluación del prototipo con reglas configuradas; no constituye un diagnóstico médico."
            : "Prototype assessment with configured rules; not a medical diagnosis."}
        </p>
        <Link href="/registros">
          {es ? "Registrar sueño o bienestar" : "Record sleep or wellbeing"} →
        </Link>
      </footer>
    </main>
  );
}
