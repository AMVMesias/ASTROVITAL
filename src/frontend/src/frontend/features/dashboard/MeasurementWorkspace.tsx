"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useLanguage } from "../../providers/LanguageProvider";

type Environment = { scenarioId: string; profileVersion: string };
type Condition = {
  metric: string;
  scope: string;
  value: number | { min: number; max: number } | null;
  unit?: string;
  sourceId?: string;
  reason?: string;
};
type Catalog = {
  revision: string;
  active: Environment | null;
  profiles: { id: string; label: string; conditions: Condition[] }[];
  sources: Record<string, { name: string; url: string }>;
};
type Reading = {
  id: string;
  value: number;
  unit: string;
  capturedAt: string;
  origin: "manual" | "device" | "simulated";
};
type Recommendation = { message: { es: string; en: string } };
type Assessment = {
  measurementId: string;
  indicator: "heart_rate" | "sleep" | "wellbeing";
  status: "insufficient" | "invalid" | "stale" | "stable" | "deviation";
  ruleVersion: string;
  evidence: string[];
  direction?: "above" | "below";
  recommendation?: Recommendation;
  reference?: { mean: number; count: number };
};
type Alert = {
  id: string;
  status: "open" | "tracking" | "closed";
  reason: Assessment["status"];
  evidence: Assessment;
};
type Summary = { latest: Reading[]; evaluation: Assessment[] };
type DashboardData = { catalog: Catalog; summary: Summary; alerts: Alert[] };

const root = "/v1/me";
async function loadDashboard(): Promise<DashboardData> {
  const options = { cache: "no-store" } as const;
  const [catalog, summary, { alerts }] = await Promise.all([
    api<Catalog>(`${root}/environment`, options),
    api<Summary>(`${root}/measurements/latest`, options),
    api<{ alerts: Alert[] }>(`${root}/alerts`, options),
  ]);
  return { catalog, summary, alerts };
}

function writeRequest(method: string, value: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json", "X-Nasa-Request": "1" },
    body: JSON.stringify(value),
  };
}

export function MeasurementWorkspace({
  view = "records",
}: {
  view?: "records" | "alerts" | "environment";
}) {
  const { locale } = useLanguage();
  const es = locale === "es";
  const [data, setData] = useState<DashboardData>();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    void loadDashboard()
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function update(change?: () => Promise<unknown>) {
    setPending(true);
    setError(false);
    try {
      await change?.();
      setData(await loadDashboard());
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  const status = es
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
  const indicators = es
    ? { heart_rate: "Pulso", sleep: "Sueño", wellbeing: "Bienestar" }
    : { heart_rate: "Heart rate", sleep: "Sleep", wellbeing: "Wellbeing" };
  const origins = es
    ? { manual: "Manual", device: "Dispositivo", simulated: "Simulado" }
    : { manual: "Manual", device: "Device", simulated: "Simulated" };
  const profile = data?.catalog.profiles.find(
    ({ id }) => id === data.catalog.active?.scenarioId,
  );

  return (
    <main className="interior">
      <h1>
        {view === "alerts"
          ? es
            ? "Avisos"
            : "Alerts"
          : view === "environment"
            ? es
              ? "Entorno de captura"
              : "Capture environment"
            : es
              ? "Registros y seguimiento"
              : "Records and follow-up"}
      </h1>
      {error && (
        <p role="alert">
          {es
            ? "No se pudo cargar o guardar. Comprueba tu sesión de astronauta y el conexión a Internet."
            : "Could not load or save. Check your astronaut session and Internet connection."}
        </p>
      )}
      {view === "records" && (
        <section>
          <h2>{es ? "Registrar medición" : "Record measurement"}</h2>
          <form
            className="data-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget,
                fields = new FormData(form);
              setPending(true);
              setError(false);
              setSaved(false);
              const indicator = String(fields.get("indicator"));
              try {
                await api(
                  "/v1/me/measurements",
                  writeRequest("POST", {
                    indicator,
                    value: Number(fields.get("value")),
                    unit: indicator === "sleep" ? "h" : "score_1_5",
                    capturedAt: new Date().toISOString(),
                    activity: String(fields.get("activity") ?? "unknown"),
                    note: String(fields.get("note") ?? ""),
                  }),
                );
                setData(await loadDashboard());
                form.reset();
                setSaved(true);
              } catch {
                setError(true);
              } finally {
                setPending(false);
              }
            }}
          >
            <label>
              {es ? "Indicador" : "Indicator"}
              <select name="indicator">
                <option value="sleep">
                  {es ? "Sueño (horas, 0–24)" : "Sleep (hours, 0–24)"}
                </option>
                <option value="wellbeing">
                  {es ? "Bienestar (entero, 1–5)" : "Well-being (integer, 1–5)"}
                </option>
              </select>
            </label>
            <label>
              {es ? "Valor" : "Value"}
              <input
                name="value"
                type="number"
                required
                min="0"
                max="24"
                step="0.1"
              />
            </label>
            <label>
              {es ? "Actividad confirmada" : "Confirmed activity"}
              <select name="activity" defaultValue="unknown">
                <option value="unknown">
                  {es ? "No confirmada" : "Unconfirmed"}
                </option>
                <option value="rest">{es ? "En reposo" : "At rest"}</option>
                <option value="exercise">
                  {es ? "Ejercicio" : "Exercise"}
                </option>
                <option value="eva">EVA</option>
              </select>
            </label>
            <label>
              {es ? "Nota" : "Note"}
              <input name="note" maxLength={1000} />
            </label>
            <button disabled={pending}>
              {es ? "Guardar medición" : "Save measurement"}
            </button>
          </form>
          {saved && (
            <p role="status">
              {es ? "Medición guardada." : "Measurement saved."}
            </p>
          )}
        </section>
      )}
      <button disabled={pending} onClick={() => void update()}>
        {es ? "Actualizar" : "Refresh"}
      </button>
      {!data && !error && <p role="status">{es ? "Cargando…" : "Loading…"}</p>}
      {data && (
        <>
          {view === "environment" && (
            <section>
              <h2>{es ? "Entorno de captura" : "Capture environment"}</h2>
              <label>
                {es ? "Escenario" : "Scenario"}{" "}
                <select
                  disabled={pending}
                  value={data.catalog.active?.scenarioId ?? ""}
                  onChange={(event) => {
                    const scenarioId = event.currentTarget.value;
                    void update(() =>
                      api(
                        `${root}/environment`,
                        writeRequest("PUT", { scenarioId }),
                      ),
                    );
                  }}
                >
                  <option value="" disabled>
                    {es ? "Selecciona un escenario" : "Select a scenario"}
                  </option>
                  {data.catalog.profiles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {profile &&
                data.catalog.active?.profileVersion ===
                  data.catalog.revision && (
                  <details>
                    <summary>
                      {es
                        ? "Referencias ambientales"
                        : "Environmental references"}
                    </summary>
                    <ul>
                      {profile.conditions.map((condition) => {
                        const { value, metric, scope, unit, sourceId, reason } =
                          condition;
                        const source = sourceId
                          ? data.catalog.sources[sourceId]
                          : undefined;
                        const description =
                          value === null
                            ? (reason ?? (es ? "Sin datos" : "No data"))
                            : typeof value === "number"
                              ? `${value} ${unit ?? ""}`
                              : `${value.min}–${value.max} ${unit ?? ""}`;
                        return (
                          <li key={metric}>
                            {metric.replaceAll("_", " ")} ({scope}) ·{" "}
                            {description}{" "}
                            {source && <a href={source.url}>{source.name}</a>}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
            </section>
          )}
          {view === "records" && (
            <section>
              <h2>{es ? "Evaluación de demostración" : "Demo assessment"}</h2>
              {data.summary.evaluation.length === 0 && (
                <p>{status.insufficient}</p>
              )}
              <ul>
                {data.summary.evaluation.map((result) => {
                  const reading = data.summary.latest.find(
                    ({ id }) => id === result.measurementId,
                  );
                  return (
                    <li key={result.measurementId}>
                      <strong>{indicators[result.indicator]}</strong> ·{" "}
                      {status[result.status]}
                      {reading && (
                        <>
                          {" "}
                          · {reading.value} {reading.unit} ·{" "}
                          {origins[reading.origin]} ·{" "}
                          <time dateTime={reading.capturedAt}>
                            {new Date(reading.capturedAt).toLocaleString(
                              locale,
                            )}
                          </time>
                        </>
                      )}
                      {result.reference && (
                        <>
                          {" "}
                          · {es ? "Referencia" : "Baseline"}{" "}
                          {result.reference.mean.toFixed(1)} (
                          {result.reference.count})
                        </>
                      )}
                      {result.direction && (
                        <>
                          {" "}
                          ·{" "}
                          {result.direction === "above"
                            ? es
                              ? "Por encima de la referencia"
                              : "Above baseline"
                            : es
                              ? "Por debajo de la referencia"
                              : "Below baseline"}
                        </>
                      )}
                      {" · "}
                      {result.ruleVersion}
                      {result.recommendation && (
                        <p>{result.recommendation.message[es ? "es" : "en"]}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {view === "alerts" && (
            <section>
              <h2>{es ? "Avisos" : "Alerts"}</h2>
              {data.alerts.length === 0 && (
                <p>{es ? "Todavía no hay avisos." : "No alerts yet."}</p>
              )}
              <ul>
                {data.alerts.map((alert) => {
                  const path = `${root}/alerts/${encodeURIComponent(alert.id)}`;
                  return (
                    <li key={alert.id}>
                      {status[alert.reason]} · {alert.evidence.ruleVersion} ·{" "}
                      {alert.status === "closed"
                        ? es
                          ? "Cerrado"
                          : "Closed"
                        : alert.status === "tracking"
                          ? es
                            ? "En seguimiento"
                            : "Tracking"
                          : es
                            ? "Abierto"
                            : "Open"}
                      {alert.evidence.recommendation && (
                        <p>
                          {
                            alert.evidence.recommendation.message[
                              es ? "es" : "en"
                            ]
                          }
                        </p>
                      )}
                      {alert.status !== "closed" && (
                        <div>
                          <label>
                            {es ? "Observación" : "Observation"}{" "}
                            <input
                              maxLength={1000}
                              value={notes[alert.id] ?? ""}
                              onChange={(event) => {
                                const note = event.currentTarget.value;
                                setNotes((current) => ({
                                  ...current,
                                  [alert.id]: note,
                                }));
                              }}
                            />
                          </label>{" "}
                          {(["track", "close"] as const).map((type) => (
                            <button
                              key={type}
                              disabled={pending}
                              onClick={() =>
                                void update(() =>
                                  api(
                                    path,
                                    writeRequest("POST", {
                                      type,
                                      note: notes[alert.id],
                                    }),
                                  ),
                                )
                              }
                            >
                              {type === "track"
                                ? es
                                  ? "Registrar seguimiento"
                                  : "Track"
                                : es
                                  ? "Cerrar aviso"
                                  : "Close alert"}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
