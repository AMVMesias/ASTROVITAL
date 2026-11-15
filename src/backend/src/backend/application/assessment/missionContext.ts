import { AppError } from "../../domain/model";
import { date, object, only } from "../../domain/validation";
import type { DecisionResult } from "./telemetryDecisionTree";

export const CONTEXT_TTL_MS = 300_000; // Prototype freshness policy, not a physiological exposure limit.
export const contextSources = [
  {id:"atmosphere",title:"NASA-STD-3001 Vol. 2 Rev. F · 6.2 / Table 6.2-1",url:"https://www.nasa.gov/wp-content/uploads/2025/05/nasa-std-3001-vol-2.pdf"},
  {id:"exercise",title:"NASA OCHMO-TB-031 · Exercise Overview",url:"https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/"},
  {id:"adaptation",title:"NASA NTRS · Cardiovascular adaptation, 4 subjects / 16 days",url:"https://ntrs.nasa.gov/citations/20040087874"},
] as const;
export type MissionContext = {
  scenarioId:string; assignmentFrom:string; capturedAt:string; sourceNote:string;
  origin:"manual"|"simulated"; location:"cabin"|"suit";
  activity:"rest"|"exercise"|"eva"|"unknown";
  phase:"preflight"|"inflight"|"surface"|"postflight";
  pressureKpa:number|null; oxygenPercent:number|null; co2Mmhg:number|null;
  co2WindowMinutes:0|60; measuredHrMax:number|null;
};
type Message={es:string;en:string};
type Finding={code:string;level:"info"|"review"|"missing";source:string;message:Message};
export const missionContextSchema = {
  type:"object",additionalProperties:false,
  required:["scenarioId","assignmentFrom","capturedAt","sourceNote","origin","location","activity","phase","pressureKpa","oxygenPercent","co2Mmhg","co2WindowMinutes","measuredHrMax"],
  properties:{
    scenarioId:{type:"string",enum:["iss_leo","moon_surface","mars_surface","deep_space_transit"]},
    assignmentFrom:{type:"string",format:"date-time"},capturedAt:{type:"string",format:"date-time"},sourceNote:{type:"string",minLength:3,maxLength:160},
    origin:{type:"string",enum:["manual","simulated"]},location:{type:"string",enum:["cabin","suit"]},
    activity:{type:"string",enum:["rest","exercise","eva","unknown"]},phase:{type:"string",enum:["preflight","inflight","surface","postflight"]},
    pressureKpa:{type:"number",nullable:true,minimum:6.3,maximum:150},oxygenPercent:{type:"number",nullable:true,minimum:0.0001,maximum:100},
    co2Mmhg:{type:"number",nullable:true,minimum:0,maximum:100},co2WindowMinutes:{type:"integer",enum:[0,60]},
    measuredHrMax:{type:"number",nullable:true,minimum:30,maximum:300},
  },
} as const;
export function validateMissionContext(value:unknown,now:Date):MissionContext {
  const input=object(value);
  only(input,Object.keys(missionContextSchema.properties));
  if(typeof input.sourceNote!=="string"||input.sourceNote.trim().length<3||input.sourceNote.length>160)throw new AppError(400,"VALIDATION","Indica el instrumento o la procedencia de estos datos (3–160 caracteres).");
  for(const [key,choices] of Object.entries({scenarioId:["iss_leo","moon_surface","mars_surface","deep_space_transit"],origin:["manual","simulated"],location:["cabin","suit"],activity:["rest","exercise","eva","unknown"],phase:["preflight","inflight","surface","postflight"],co2WindowMinutes:[0,60]})) {
    if(!choices.includes(input[key] as never))throw new AppError(400,"VALIDATION",`Revisa ${key}.`);
  }
  for(const [key,min,max] of [["pressureKpa",6.3,150],["oxygenPercent",0.0001,100],["co2Mmhg",0,100],["measuredHrMax",30,300]] as const){
    const v=input[key];
    if(v!==null&&(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max))throw new AppError(400,"VALIDATION",`Revisa ${key}; usa un número en la unidad indicada o null si no lo conoces.`);
  }
  const capturedAt=date(input.capturedAt,"capturedAt"),assignmentFrom=date(input.assignmentFrom,"assignmentFrom");
  if(Date.parse(capturedAt)>now.getTime()||Date.parse(capturedAt)<Date.parse(assignmentFrom))throw new AppError(400,"VALIDATION","La fecha debe pertenecer al escenario actual y no estar en el futuro.");
  if(input.co2Mmhg!==null&&input.pressureKpa!==null&&(input.co2Mmhg as number) > (input.pressureKpa as number)*7.50061683)throw new AppError(400,"VALIDATION","La presión parcial de CO₂ supera la presión total.");
  return {...input,capturedAt,assignmentFrom} as MissionContext;
}

/** Independent environmental screening. Never changes a physiological measurement or removes its warning. */
export function analyzeMissionContext(context:MissionContext|null,telemetry:DecisionResult,assignmentFrom:string,now:Date) {
  const findings:Finding[]=[];
  const add=(code:string,level:Finding["level"],source:string,es:string,en:string)=>findings.push({code,level,source,message:{es,en}});
  const available=!!context&&context.scenarioId===telemetry.scenario.id&&context.assignmentFrom===assignmentFrom;
  const age=available?now.getTime()-Date.parse(context.capturedAt):Infinity;
  const fresh=available&&age>=0&&age<=CONTEXT_TTL_MS;
  if(!fresh)return {version:"mission-context-1",status:available?"stale":"missing",input:available?context:null,expiresAt:available?new Date(Date.parse(context.capturedAt)+CONTEXT_TTL_MS).toISOString():null,
    environment:{status:"missing",pio2Mmhg:null},personal:{hrPercentMax:null},findings,sources:contextSources};
  const c=context!;
  const pio2=c.pressureKpa!==null&&c.oxygenPercent!==null?(c.pressureKpa*7.50061683-47)*c.oxygenPercent/100:null;
  if(pio2===null)add("oxygen_missing","missing","atmosphere","Faltan presión interior y/o O₂. No se sustituirán por valores exteriores del planeta.","Interior pressure and/or O₂ is missing. Planet exterior values are not substituted.");
  else if(pio2<127)add("oxygen_below_reference","review","atmosphere","PiO₂ por debajo de 127 mmHg, límite inferior publicado para exposición con vigilancia. Verifica el registro y consulta el procedimiento de misión; no ajustes el traje desde este prototipo.","PiO₂ is below 127 mmHg, the published lower reference for monitored exposure. Verify the record and consult mission procedures; do not adjust a suit through this prototype.");
  else if(pio2<145)add("oxygen_monitoring","review","atmosphere","PiO₂ entre 127 y 145 mmHg: por debajo del objetivo de normoxia. Requiere un protocolo de vigilancia y mitigación autorizado; no se considera normal automáticamente.","PiO₂ is between 127 and 145 mmHg: below the normoxia target. An authorized monitoring and mitigation protocol is needed; this is not automatically treated as normal.");
  else if(pio2>356)add("oxygen_exposure_protocol","review","atmosphere","PiO₂ supera 356 mmHg, referencia superior de exposición indefinida. Los protocolos de exposición breve no se evalúan aquí: verifica duración y procedimiento autorizado.","PiO₂ exceeds 356 mmHg, the indefinite-exposure upper reference. Short-exposure protocols are not evaluated here: verify duration and the authorized procedure.");
  else add("oxygen_reference","info","atmosphere",pio2<=155?"PiO₂ en el objetivo de normoxia de 145–155 mmHg. Esto no certifica el ambiente ni predice la SpO₂.":"PiO₂ por encima del objetivo de normoxia y dentro de la referencia superior de exposición indefinida; puede corresponder a atmósfera enriquecida. Debe verificarse el protocolo de misión.",pio2<=155?"PiO₂ is in the 145–155 mmHg normoxia target. This neither certifies the environment nor predicts SpO₂.":"PiO₂ is above the normoxia target and within the indefinite-exposure upper reference; it may reflect an oxygen-enriched atmosphere. Verify the mission protocol.");
  if(c.co2Mmhg===null)add("co2_missing","missing","atmosphere","CO₂ interior no disponible: no se evalúa acumulación de CO₂.","Interior CO₂ is unavailable: CO₂ accumulation is not evaluated.");
  else if(c.location==="suit")add("co2_suit_protocol","missing","atmosphere","CO₂ del traje registrado. El límite de 3 mmHg de cabina no se aplica al traje; falta su protocolo y ventana de exposición específicos.","Suit CO₂ recorded. The cabin 3 mmHg limit does not apply to a suit; a suit-specific protocol and exposure window are required.");
  else if(c.co2WindowMinutes!==60)add("co2_spot",c.co2Mmhg>3?"review":"missing","atmosphere","Lectura puntual de CO₂: no permite verificar el límite de promedio de una hora de cabina (3 mmHg). Obtén ese promedio; una lectura elevada requiere comprobación.","Spot CO₂ reading: it cannot verify the cabin one-hour-average limit (3 mmHg). Obtain that average; an elevated spot reading requires checking.");
  else add("co2_average",c.co2Mmhg>3?"review":"info","atmosphere",c.co2Mmhg>3?"El promedio de una hora de CO₂ supera 3 mmHg. Comprueba el registro y el sistema de ventilación según el procedimiento de misión; no demuestra la causa de una variación respiratoria.":"El promedio de una hora de CO₂ no supera la referencia de 3 mmHg. No descarta otros riesgos respiratorios.",c.co2Mmhg>3?"The one-hour CO₂ average exceeds 3 mmHg. Check the record and ventilation through mission procedures; this does not establish the cause of a respiratory change.":"The one-hour CO₂ average does not exceed the 3 mmHg reference. Other respiratory risks are not ruled out.");
  const pulse=telemetry.telemetry.indicators.find(i=>i.key==="bpm_ecg");
  const telemetryAge=telemetry.telemetry.latestAt?now.getTime()-Date.parse(telemetry.telemetry.latestAt):Infinity;
  const pulseValid=pulse?.quality==="valid"&&pulse.value!==null&&telemetryAge>=0&&telemetryAge<=30_000;
  const effort=c.activity==="exercise"||c.activity==="eva";
  const ratio=pulseValid&&effort&&c.measuredHrMax!==null?pulse!.value!/c.measuredHrMax*100:null;
  add("activity_context","info","exercise",effort?"Actividad de esfuerzo: no comparar este pulso con reposo. La intensidad requiere referencia individual y un protocolo de actividad.":c.activity==="rest"?"Reposo confirmado en el registro contextual: compara con tu referencia personal de reposo del mismo entorno; no se calcula una nueva referencia con este formulario.":"Actividad desconocida: no interpretar el pulso como reposo ni esfuerzo confirmado.",effort?"Exertion activity: do not compare this pulse with rest. Intensity needs an individual reference and an activity protocol.":c.activity==="rest"?"Rest confirmed in the contextual record: compare with the personal resting baseline in the same environment; this form does not compute a new baseline.":"Unknown activity: do not interpret pulse as confirmed rest or exertion.");
  if(effort&&c.measuredHrMax===null)add("hr_reference_missing","missing","exercise","Falta FC máxima individual medida antes del vuelo; no se estima por edad o gravedad.","Preflight individually measured maximum HR is missing; it is not estimated from age or gravity.");
  if(ratio!==null)add("hr_ratio",ratio>100?"review":"info","exercise",`Pulso ECG: ${ratio.toFixed(1)} % de la FC máxima registrada. Es una relación de intensidad, no una autorización de esfuerzo ni un límite clínico lunar/marciano.`,`ECG pulse: ${ratio.toFixed(1)}% of recorded maximum HR. This is an intensity ratio, not exercise clearance or a lunar/Martian clinical limit.`);
  add("mission_phase","info","adaptation",`Fase registrada: ${c.phase}. La adaptación puede modificar la referencia individual; el estudio de microgravedad no se extrapola como multiplicador a Luna o Marte.`,`Recorded phase: ${c.phase}. Adaptation can change the individual baseline; the microgravity study is not extrapolated as a Moon/Mars multiplier.`);
  return {version:"mission-context-1",status:"fresh",input:c,expiresAt:new Date(Date.parse(c.capturedAt)+CONTEXT_TTL_MS).toISOString(),
    environment:{status:findings.some(f=>f.source==="atmosphere"&&f.level==="review")?"review":findings.some(f=>f.source==="atmosphere"&&f.level==="missing")?"incomplete":"within_reference",pio2Mmhg:pio2===null?null:Math.round(pio2*10)/10},
    personal:{hrPercentMax:ratio===null?null:Math.round(ratio*10)/10},findings,sources:contextSources};
}
