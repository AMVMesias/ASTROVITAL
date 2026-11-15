"use client";

import { useState, type FormEvent } from "react";
import { api, writeRequest } from "../../lib/api";
import styles from "./missionContext.module.css";

type ContextInput = {
  scenarioId:string;assignmentFrom:string;capturedAt:string;sourceNote:string;
  origin:"manual"|"simulated";location:"cabin"|"suit";activity:"rest"|"exercise"|"eva"|"unknown";
  phase:"preflight"|"inflight"|"surface"|"postflight";
  pressureKpa:number|null;oxygenPercent:number|null;co2Mmhg:number|null;co2WindowMinutes:0|60;measuredHrMax:number|null;
};
export type ContextResult = {
  status:string;input:ContextInput|null;expiresAt:string|null;
  environment:{status:string;pio2Mmhg:number|null};personal:{hrPercentMax:number|null};
  findings:{code:string;level:string;source:string;message:{es:string;en:string}}[];
  sources:{id:string;title:string;url:string}[];
};
type Comparison={timestamp:string;physiologicalLevel:string;telemetry:{latestAt:string|null;indicators:{key:string;value:number|null;unit:string}[]};examples:{id:string;result:ContextResult}[]};
const initial={origin:"manual",location:"cabin",activity:"unknown",phase:"inflight",capturedAt:"",sourceNote:"",pressureKpa:"",oxygenPercent:"",co2Mmhg:"",co2WindowMinutes:"0",measuredHrMax:""};
const localTime=()=>{const date=new Date();return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19);};

export function MissionContextPanel({scenarioId,assignmentFrom,analysis,latestTelemetryAt,now,es,onSaved}:{scenarioId:string;assignmentFrom:string;analysis:ContextResult;latestTelemetryAt:string|null;now:number;es:boolean;onSaved:()=>void}) {
  const [form,setForm]=useState(initial),[busy,setBusy]=useState(false),[comparing,setComparing]=useState(false);
  const [notice,setNotice]=useState(""),[error,setError]=useState(""),[comparison,setComparison]=useState<Comparison|null>(null);
  const text=(a:string,b:string)=>es?a:b;
  const update=(key:keyof typeof initial,value:string)=>setForm(previous=>({...previous,[key]:value}));
  const fresh=analysis.status==="fresh"&&!!analysis.expiresAt&&now<=Date.parse(analysis.expiresAt);
  const pulseFresh=!!latestTelemetryAt&&now-Date.parse(latestTelemetryAt)<=30000;
  const status=(value:string)=>({review:text("Revisar condiciones","Review conditions"),within_reference:text("Dentro de las referencias evaluadas","Within evaluated references"),incomplete:text("Evaluación incompleta","Incomplete assessment"),missing:text("Sin datos vigentes","No current data")}[value]??value);
  async function save(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      const number=(key:keyof typeof initial)=>form[key].trim()===""?null:Number(form[key]);
      await api("/v1/me/dss/context",writeRequest("PUT",{...form,scenarioId,assignmentFrom,capturedAt:new Date(form.capturedAt).toISOString(),pressureKpa:number("pressureKpa"),oxygenPercent:number("oxygenPercent"),co2Mmhg:number("co2Mmhg"),co2WindowMinutes:Number(form.co2WindowMinutes),measuredHrMax:number("measuredHrMax")}));
      setNotice(text("Contexto guardado. Actualizando evaluación…","Context saved. Refreshing assessment…"));onSaved();
    } catch(err){setError(err instanceof Error?err.message:text("No se pudo guardar.","Could not save."));}finally{setBusy(false);}
  }
  async function clear() {
    setBusy(true);setError("");setNotice("");
    try{await api("/v1/me/dss/context",writeRequest("DELETE"));setNotice(text("Contexto retirado.","Context cleared."));onSaved();}
    catch(err){setError(err instanceof Error?err.message:"Error");}finally{setBusy(false);}
  }
  async function compare() {
    setComparing(true);setError("");
    try{setComparison(await api<Comparison>("/v1/me/dss/context/compare"));}catch(err){setError(err instanceof Error?err.message:"Error");}finally{setComparing(false);}
  }
  function example(){setForm({...initial,origin:"simulated",activity:"exercise",capturedAt:localTime(),sourceNote:text("Ejemplo sintético de cabina; no medido","Synthetic cabin example; not measured"),pressureKpa:"101.325",oxygenPercent:"21",co2Mmhg:"1",co2WindowMinutes:"60",measuredHrMax:"180"});setNotice(text("Ejemplo cargado en el formulario; aún no se ha guardado.","Example loaded into the form; not saved yet."));}
  return <section className={`${styles.panel} ${fresh&&analysis.environment.status==="review"?styles.review:""}`} aria-label={text("Contexto y ambiente respirable","Context and breathing environment")}>
    <header><div><span className={styles.eyebrow}>{text("CONTEXTO DE MISIÓN","MISSION CONTEXT")}</span><h3>{text("Ambiente respirable e intensidad","Breathing environment and intensity")}</h3></div><strong role="status">{fresh?status(analysis.environment.status):text(analysis.input?"Registro caducado":"Falta contexto interior",analysis.input?"Record expired":"Interior context missing")}</strong></header>
    <p>{text("Usa la presión y composición interiores de cabina o traje. Seleccionar Luna o Marte no determina lo que respira la persona.","Use the interior pressure and composition of a cabin or suit. Selecting the Moon or Mars does not determine what the person breathes.")}</p>
    {analysis.input&&<p className={styles.meta}><b>{analysis.input.origin==="simulated"?text("SIMULADO","SIMULATED"):text("REGISTRO MANUAL","MANUAL RECORD")}</b> · {analysis.input.location==="cabin"?text("Cabina","Cabin"):text("Traje","Suit")} · <time dateTime={analysis.input.capturedAt}>{new Date(analysis.input.capturedAt).toLocaleString(es?"es":"en")}</time><br/>{analysis.input.sourceNote}</p>}
    {fresh&&<>
      <div className={styles.values}>
        <div><span>{text("Presión absoluta","Absolute pressure")}</span><b>{analysis.input?.pressureKpa??"—"} kPa</b></div>
        <div><span>O₂</span><b>{analysis.input?.oxygenPercent??"—"} %</b></div>
        <div><span>PiO₂</span><b>{analysis.environment.pio2Mmhg??"—"} mmHg</b></div>
        <div><span>CO₂ · {analysis.input?.co2WindowMinutes===60?text("media 1 h","1 h mean"):text("puntual","spot")}</span><b>{analysis.input?.co2Mmhg??"—"} mmHg</b></div>
      </div>
      {analysis.personal.hrPercentMax!==null&&pulseFresh&&<p><b>{analysis.personal.hrPercentMax} % FC máx.</b> · {text("Pulso ECG / máxima individual declarada como medida antes del vuelo.","ECG pulse / individual maximum declared as measured preflight.")}</p>}
      <details><summary>{text("Interpretación y fundamento","Interpretation and basis")}</summary><ul>{analysis.findings.filter(f=>f.code!=="hr_ratio"||pulseFresh).map(f=><li key={f.code} data-level={f.level}>{f.message[es?"es":"en"]}</li>)}</ul></details>
    </>}
    <details className={styles.editor}><summary>{text("Registrar condiciones interiores","Record interior conditions")}</summary>
      <form onSubmit={save}><fieldset disabled={busy}><div className={styles.form}>
        <label>{text("Origen","Origin")}<select value={form.origin} onChange={e=>update("origin",e.target.value)}><option value="manual">{text("Medición introducida manualmente","Manually entered measurement")}</option><option value="simulated">{text("Datos simulados","Simulated data")}</option></select></label>
        <label>{text("Ambiente respirado","Breathing environment")}<select value={form.location} onChange={e=>update("location",e.target.value)}><option value="cabin">{text("Cabina","Cabin")}</option><option value="suit">{text("Traje","Suit")}</option></select></label>
        <label>{text("Actividad actual","Current activity")}<select value={form.activity} onChange={e=>update("activity",e.target.value)}>{[["unknown",text("Desconocida","Unknown")],["rest",text("Reposo","Rest")],["exercise",text("Ejercicio","Exercise")],["eva","EVA"]].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label>{text("Fase de misión","Mission phase")}<select value={form.phase} onChange={e=>update("phase",e.target.value)}>{[["preflight",text("Antes del vuelo","Preflight")],["inflight",text("En vuelo","In flight")],["surface",text("En superficie","On the surface")],["postflight",text("Después del vuelo","Postflight")]].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        {([["pressureKpa",text("Presión absoluta interior (kPa)","Interior absolute pressure (kPa)"),6.3,150],["oxygenPercent",text("Fracción de O₂ seco (%)","Dry O₂ fraction (%)"),0.0001,100],["co2Mmhg",text("Presión parcial de CO₂ (mmHg)","CO₂ partial pressure (mmHg)"),0,100],["measuredHrMax",text("FC máxima individual medida pre-vuelo (bpm)","Individual maximum HR measured preflight (bpm)"),30,300]] as const).map(([key,label,min,max])=><label key={key}>{label}<input type="number" step="any" min={min} max={max} value={form[key]} onChange={e=>update(key,e.target.value)} placeholder={text("Vacío = desconocido","Blank = unknown")}/></label>)}
        <label>{text("Ventana del CO₂ introducido","Window of entered CO₂")}<select value={form.co2WindowMinutes} onChange={e=>update("co2WindowMinutes",e.target.value)}><option value="0">{text("Lectura puntual","Spot reading")}</option><option value="60">{text("Promedio real de una hora","Actual one-hour average")}</option></select></label>
        <label>{text("Fecha de observación (hora local)","Observation time (local)")}<input required type="datetime-local" step="1" value={form.capturedAt} onChange={e=>update("capturedAt",e.target.value)}/><button type="button" onClick={()=>update("capturedAt",localTime())}>{text("Usar hora actual","Use current time")}</button></label>
        <label className={styles.full}>{text("Instrumento / procedencia (indica si es sintético)","Instrument / provenance (identify synthetic data)")}<input required minLength={3} maxLength={160} value={form.sourceNote} onChange={e=>update("sourceNote",e.target.value)}/></label>
      </div><p className={styles.meta}>{text("El CO₂ no se calcula a partir del oxímetro. La actividad no cambia el registro BLE ni su historial. Los datos vacíos quedan sin evaluar.","CO₂ is not calculated from the oximeter. Activity does not change BLE records or their history. Blank inputs remain unevaluated.")}</p><div className={styles.buttons}><button type="submit">{text("Guardar y evaluar","Save and assess")}</button><button type="button" onClick={example}>{text("Cargar ejemplo simulado","Load simulated example")}</button><button type="button" onClick={()=>void clear()}>{text("Retirar contexto","Clear context")}</button></div></fieldset></form>
    </details>
    <div className={styles.buttons}><button type="button" disabled={comparing} onClick={()=>void compare()}>{comparing?text("Comparando…","Comparing…"):text("Comparar 3 ambientes con los mismos sensores","Compare 3 environments with the same sensors")}</button></div>
    {comparison&&<div className={styles.comparison}><h4>{text("Comparación sintética · misma captura","Synthetic comparison · same snapshot")}</h4><p className={styles.meta}>{new Date(comparison.timestamp).toLocaleString(es?"es":"en")} · {text("Resultado fisiológico común","Common physiological result")}: {comparison.physiologicalLevel}. {text("No guarda estos ejemplos en tu registro.","These examples are not saved to your record.")}</p><p>{comparison.telemetry.indicators.map(i=>`${i.key}: ${i.value??"—"} ${i.unit}`).join(" · ")}</p><div className={styles.examples}>{comparison.examples.map(({id,result})=><article key={id}><h4>{id==="nominal"?text("Cabina de referencia","Reference cabin"):id==="low_oxygen"?text("Menor presión, mismo O₂","Lower pressure, same O₂"):text("CO₂ elevado","Elevated CO₂")}</h4><p>{result.input?.pressureKpa} kPa · {result.input?.oxygenPercent} % O₂ · {result.input?.co2Mmhg} mmHg CO₂ (1 h)</p><b>PiO₂: {result.environment.pio2Mmhg} mmHg</b><p>{status(result.environment.status)}</p><ul>{result.findings.filter(f=>f.source==="atmosphere"&&f.level!=="info").map(f=><li key={f.code}>{f.message[es?"es":"en"]}</li>)}</ul></article>)}</div></div>}
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <p className={styles.meta}>{text("Vigencia del contexto: 5 minutos, política técnica del prototipo. El ambiente se evalúa por separado; no reduce alertas personales ni predice la SpO₂. Sin diagnóstico ni autorización EVA.","Context validity: 5 minutes, a prototype technical policy. The environment is assessed separately; it does not reduce personal warnings or predict SpO₂. No diagnosis or EVA clearance.")}</p>
    <details><summary>{text("Fuentes y cálculo","Sources and calculation")}</summary><p>PiO₂ = (P [kPa] × 7.50061683 − 47) × O₂ [%] / 100.</p><p>{text("La referencia de CO₂ de 3 mmHg corresponde a cabina y al promedio de una hora, no al traje. La gravedad y la fase no generan multiplicadores fisiológicos.","The 3 mmHg CO₂ reference is for a cabin one-hour average, not a suit. Gravity and mission phase do not generate physiological multipliers.")}</p><ul>{analysis.sources.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>
  </section>;
}
