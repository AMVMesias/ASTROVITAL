"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, writeRequest } from "../../lib/api";
import { useLanguage } from "../../providers/LanguageProvider";
import styles from "./telemetryDecision.module.css";

type Indicator = {key:string;label:string;value:number|null;unit:string;quality:string;detail:string;trend?:number;trendSeconds?:number;checkRequired?:boolean;alertLevel?:"review"|"priority"|null};
type Action = {id:string;priority:"priority"|"check"|"follow_up";title:string;reason:string;steps:string[];expected:string;escalation?:string};
type Result = {
  version:string;timestamp:string;scenario:{id:string;label:string;context?:string;radiation:{instrument:string|null;location:string;n:number;p05?:number;median?:number;p95?:number;unit:string;interpretation:string;provenance?:string}|null};
  state:{level:string;title:string;explanation:string;recommendations:string[];actions?:Action[];evidence:string[]};
  telemetry:{count:number;latestAt:string|null;ageSeconds:number|null;indicators:Indicator[]};
  rules:{freshnessSeconds:number;trendWindowSeconds:number};limitations:string[];
};
type Environment = {profiles:{id:string;label:string}[];active:{scenarioId:string}|null};

export function TelemetryDecisionPanel() {
  const {locale}=useLanguage(), es=locale==="es";
  const requestVersion=useRef(0),saving=useRef(false);
  const [environment,setEnvironment]=useState<Environment|null>(null);
  const [result,setResult]=useState<Result|null>(null);
  const [error,setError]=useState(false),[pending,setPending]=useState(false);
  const [needsEnvironment,setNeedsEnvironment]=useState(false);
  const [refreshKey,setRefreshKey]=useState(0),[now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    async function load() {
      if(saving.current){timer=setTimeout(()=>void load(),15000);return;}
      const version=++requestVersion.current;
      try {
        const [env,dss]=await Promise.allSettled([
          api<Environment>("/v1/me/environment",{signal:controller.signal}),
          api<Result>("/v1/me/dss",{signal:controller.signal}),
        ]);
        if(controller.signal.aborted||version!==requestVersion.current)return;
        if(env.status==="fulfilled")setEnvironment(env.value);
        if(dss.status==="fulfilled")setResult(env.status==="fulfilled"&&env.value.active?.scenarioId!==dss.value.scenario.id?null:dss.value);
        else if(dss.reason instanceof ApiError&&dss.reason.code==="ENVIRONMENT_MISSING")setResult(null);
        const missing=dss.status==="rejected"&&dss.reason instanceof ApiError&&dss.reason.code==="ENVIRONMENT_MISSING";
        setNeedsEnvironment(missing);
        setError(env.status==="rejected"||(dss.status==="rejected"&&!missing));
      } finally {
        if(!controller.signal.aborted)timer=setTimeout(()=>void load(),15000);
      }
    }
    void load();
    return ()=>{controller.abort();clearTimeout(timer);};
  },[refreshKey]);
  useEffect(()=>{
    const clock=setInterval(()=>setNow(Date.now()),1000);
    let last=0;
    const captured=()=>{if(Date.now()-last>=5000){last=Date.now();setRefreshKey(key=>key+1);}};
    window.addEventListener("astrovital:measurement",captured);
    return ()=>{clearInterval(clock);window.removeEventListener("astrovital:measurement",captured);};
  },[]);
  async function select(scenarioId:string) {
    saving.current=true;requestVersion.current++;
    setPending(true);setResult(null);setError(false);
    try {
      await api("/v1/me/environment",writeRequest("PUT",{scenarioId}));
      setResult(null);setRefreshKey(key=>key+1);
      window.dispatchEvent(new Event("astrovital:measurement"));
    } catch {setError(true);} finally {saving.current=false;setPending(false);}
  }
  const elapsed=result?Math.max(0,(now-Date.parse(result.timestamp))/1000):0;
  const age=result?.telemetry.ageSeconds==null?null:Math.floor(result.telemetry.ageSeconds+elapsed);
  const expired=!!result?.telemetry.latestAt&&now-Date.parse(result.telemetry.latestAt)>result.rules.freshnessSeconds*1000;
  const attention=!!result&&!expired&&["priority","review"].includes(result.state.level);
  return <section className={`${styles.panel} ${attention?styles.attention:""}`} aria-label={es?"Evaluación de sensores y escenario":"Sensor and scenario assessment"}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>ASTROVITAL DSS</p><h2>{es?"Sensores y entorno de misión":"Sensors and mission environment"}</h2></div>
      <button type="button" disabled={pending} onClick={()=>setRefreshKey(key=>key+1)}>{es?"Actualizar análisis":"Refresh analysis"}</button>
    </header>
    <div className={styles.controls}>
      <label>{es?"Escenario activo":"Active scenario"}
        <select aria-label={es?"Escenario activo DSS":"Active DSS scenario"} disabled={pending||!environment} value={environment?.active?.scenarioId??""} onChange={event=>void select(event.currentTarget.value)}>
          <option value="" disabled>{es?"Selecciona un escenario":"Select a scenario"}</option>
          {environment?.profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.label}</option>)}
        </select>
      </label>
      <span>{pending?(es?"Guardando escenario…":"Saving scenario…"):(es?"Actualización cada 15 s":"Refreshes every 15 s")}</span>
    </div>
    {error&&<p role="alert" className={styles.error}>{es?"No se pudo actualizar el análisis. Comprueba la conexión; la fecha del resultado anterior sigue visible.":"Analysis could not be refreshed. Check your connection; the previous result timestamp remains visible."}</p>}
    {!result&&!error&&<p role="status">{(needsEnvironment||(environment&&!environment.active))?(es?"Selecciona un escenario para analizar las nuevas lecturas.":"Select a scenario to analyze new readings."):(es?"Cargando análisis…":"Loading analysis…")}</p>}
    {result&&!pending&&<>
      <div className={styles.state} role={attention?"alert":"status"}>
        <strong>{expired?(es?"Datos desactualizados":"Stale data"):result.state.title}</strong>
        <p>{expired?(es?"La última muestra ya no es actual. Se requiere una lectura nueva antes de interpretar el estado.":"The latest sample is no longer current. A new reading is required to interpret its status."):result.state.explanation}</p>
      </div>
      <p className={styles.metadata}>{es?"Última muestra":"Last sample"}: {result.telemetry.latestAt?<time dateTime={result.telemetry.latestAt}>{new Date(result.telemetry.latestAt).toLocaleString(locale)}</time>:"—"} · {es?"Antigüedad":"Age"}: {age??"—"} s · {es?"Muestras recientes":"Recent samples"}: {result.telemetry.count}</p>
      <div className={styles.metrics}>{result.telemetry.indicators.map(indicator=><article key={indicator.key} className={!expired&&indicator.quality==="valid"&&indicator.alertLevel?styles.metricAlert:undefined}>
        <h3>{indicator.label}</h3>
        <strong>{expired||indicator.value===null?(es?"Sin dato vigente":"No current value"):`${indicator.value} ${indicator.unit}`}</strong>
        <p>{indicator.detail}</p>
        {!expired&&indicator.quality==="valid"&&indicator.alertLevel&&<span className={styles.alertBadge}>{indicator.checkRequired?(es?"Señal a comprobar":"Signal needs checking"):(es?"Alerta · verificar lectura":"Alert · verify reading")}</span>}
        {!expired&&indicator.trend!==undefined&&<small>Δ {indicator.trend>0?"+":""}{indicator.trend} {indicator.key==="spo2"?"pp":indicator.unit} · {indicator.trendSeconds!==undefined?`${indicator.trendSeconds} s`:`${es?"ventana":"window"} ${result.rules.trendWindowSeconds} s`}</small>}
      </article>)}</div>
      {(!expired||result.state.actions?.every(action=>["restore-capture","start-capture"].includes(action.id)))&&<div className={styles.actions}>
        <h3>{es?"Qué hacer ahora":"What to do now"}</h3>
        {result.state.actions?.length?<ol className={styles.actionList}>{result.state.actions.map(action=><li key={action.id} className={`${styles.action} ${action.priority==="priority"?styles.urgent:""}`}>
          <div className={styles.actionHeading}><h4>{action.title}</h4><span>{action.priority==="priority"?(es?"Prioridad":"Priority"):action.priority==="check"?(es?"Comprobar":"Check"):(es?"Seguimiento":"Follow-up")}</span></div>
          <p>{action.reason}</p>
          {action.escalation&&<p className={styles.escalation}>{action.escalation}</p>}
          <ol>{action.steps.map(step=><li key={step}>{step}</li>)}</ol>
          <p className={styles.expected}><strong>{es?"Qué comprobar: ":"What to check: "}</strong>{action.expected}</p>
        </li>)}</ol>:<ul>{result.state.recommendations.map(text=><li key={text}>{text}</li>)}</ul>}
      </div>}
      {result.state.evidence.length>0&&<details><summary>{es?"Evidencia del análisis":"Analysis evidence"}</summary><ul>{result.state.evidence.map((text,index)=><li key={index}>{text}</li>)}</ul><small>{es?"Calculado":"Calculated"}: <time dateTime={result.timestamp}>{new Date(result.timestamp).toLocaleString(locale)}</time></small></details>}
      {result.scenario.radiation&&<details><summary>{es?"Referencia histórica de radiación":"Historical radiation reference"}</summary>
        {result.scenario.radiation.n>0?<p>{result.scenario.radiation.instrument} · {result.scenario.radiation.location} · n={result.scenario.radiation.n.toLocaleString(locale)} · p05={result.scenario.radiation.p05} · {es?"mediana":"median"}={result.scenario.radiation.median} · p95={result.scenario.radiation.p95} {result.scenario.radiation.unit}</p>:<p>{es?"Sin serie instrumental ISS aportada.":"No ISS instrumental series supplied."}</p>}
        {result.scenario.context&&<p>{result.scenario.context}</p>}
        <p>{result.scenario.radiation.interpretation}</p><p>{es?"Resumen aportado; percentiles no recalculados sin los CSV originales. No representa dosis personal ni límites de seguridad.":"Supplied summary; percentiles have not been recalculated without the original CSVs. It does not represent personal dose or safety limits."}</p>
      </details>}
      <details><summary>{es?"Alcance de las reglas":"Scope of the rules"}</summary><ul>{result.limitations.map(text=><li key={text}>{text}</li>)}</ul><p><a href="https://www.fda.gov/consumers/consumer-updates/pulse-oximeter-basics" target="_blank" rel="noreferrer">{es?"Cómo comprobar una lectura: FDA":"Checking a reading: FDA"}</a> · <a href="https://medlineplus.gov/lab-tests/pulse-oximetry/" target="_blank" rel="noreferrer">{es?"Orientación general: MedlinePlus":"General guidance: MedlinePlus"}</a></p><small>{result.version}</small></details>
    </>}
  </section>;
}
