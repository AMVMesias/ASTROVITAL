import {telemetryActions,type TelemetryAction} from "./telemetryActions";
/** Regla documental / demostrativa. No es un diagnóstico ni protocolo EVA.
 * Analiza campos REALES del contrato TelemetryService y NUNCA convierte
 * radiación ambiental en dosis personal o cambios fisiológicos.
 */
export type TelemetryFields = {
 ecg:number;bpm_ecg:number;estado_ecg_x50:number;resp_mg:number;rpm:number;
 estado_resp_x50:number;spo2:number;bpm_oxi:number;estado_oxi_x50:number;ir:number;rojo:number;
};
export type TelemetrySample = {readingId:string; capturedAt:string; receivedAt?:string; deviceId?:string; fields:TelemetryFields};
export type Level = "no_data" | "sensor_issue" | "insufficient" | "observing" | "review" | "priority";
export type Indicator = {key:string;label:string;value:number|null;unit:string;quality:"valid"|"unavailable"|"stale";detail:string;trend?:number;trendSeconds?:number;checkRequired?:boolean;alertLevel:"review"|"priority"|null};
export type RadiationRef = {mission:string;instrument:string|null;location:string;n:number;from?:string;to?:string;p05?:number;median?:number;p95?:number;unit:string;interpretation:string;provenance?:string};
export type DecisionResult = {
 version:string;timestamp:string; scenario:{id:string;label:string;scope:string;radiation:RadiationRef|null;context:string};
 state:{level:Level;title:string;explanation:string;recommendations:string[];actions:TelemetryAction[];evidence:string[]};
 telemetry:{count:number;latestAt:string|null;ageSeconds:number|null;indicators:Indicator[];lastReadingId:string|null;deviceId:string|null};
 limitations:string[];
};
export const telemetryQualityRules={pulseJumpLpm:40,pulseJumpMaxSeconds:10,pulseFormatCeiling:300};
const OXIMETER_OK = new Set([150,200]);
const finite=(n:number)=>Number.isFinite(n);
const round=(n:number,d=1)=>Number(n.toFixed(d));
function median(vals:number[]):number|null {if(!vals.length)return null;const s=[...vals].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return (s.length%2?s[m]:(s[m-1]+s[m])/2);}
function sensorValue(fields:TelemetryFields,key:'spo2'|'bpm_ecg'|'bpm_oxi'|'rpm'):number|null {
 const n=fields[key];
 if(!finite(n))return null;
 switch(key){
 case 'spo2':return OXIMETER_OK.has(fields.estado_oxi_x50)&&n>0&&n<=100?n:null;
 case 'bpm_ecg':return fields.estado_ecg_x50===100&&n>0&&n<=300?n:null;
 case 'bpm_oxi':return fields.estado_oxi_x50===200&&n>0&&n<=300?n:null;
 case 'rpm':return fields.estado_resp_x50===100&&n>0&&n<=60?n:null;
 }
}
function levelRank(s:Level):number{return ({no_data:0,sensor_issue:1,insufficient:2,observing:3,review:4,priority:5})[s];}
export function analyzeTelemetry(input:{samples:readonly TelemetrySample[];scenarioId:string;scenarioLabel:string;scenarioScope:string;maxAgeMs?:number;radiation:RadiationRef|null;now?:Date;scenarioStartedAt?:string}):DecisionResult {
 const now=input.now??new Date();const nowMs=now.getTime();
 if(!Number.isFinite(nowMs))throw new Error("Invalid analysis clock");
 const maxAgeMs=input.maxAgeMs??30000;
 if(!Number.isFinite(maxAgeMs)||maxAgeMs<=0||maxAgeMs>120000)throw new Error("Invalid freshness limit");
 const since=input.scenarioStartedAt?Date.parse(input.scenarioStartedAt):NaN;
 if(input.scenarioStartedAt&&!Number.isFinite(since))throw new Error("Invalid scenario start");
 const seen=new Set<string>();
 const ordered=[...input.samples].filter(s=>Number.isFinite(Date.parse(s.capturedAt)) && Date.parse(s.capturedAt)<=nowMs &&
 (!Number.isFinite(since)||Date.parse(s.capturedAt)>=since)).sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt));
 const unique=ordered.filter(s=>{const key=JSON.stringify([s.deviceId??"",s.readingId]);if(seen.has(key))return false;seen.add(key);return true;});
 const latest=unique[0];
 const samples=unique.filter(s=>s.deviceId===latest?.deviceId);const age=latest?Math.max(0,Math.floor((nowMs-Date.parse(latest.capturedAt))/1000)):null;
 const recent=samples.filter(s=>{const age=nowMs-Date.parse(s.capturedAt);return age>=-60000&&age<=120000;});
 const stale=latest ? nowMs-Date.parse(latest.capturedAt)>maxAgeMs : false;
 const get=(key:'spo2'|'bpm_ecg'|'bpm_oxi'|'rpm')=>latest&&!stale?sensorValue(latest.fields,key):null;
 const series=(key:'spo2'|'bpm_ecg'|'bpm_oxi'|'rpm')=>recent.map(s=>sensorValue(s.fields,key)).filter((v):v is number=>v!==null);
 const metric=(key:'spo2'|'bpm_ecg'|'bpm_oxi'|'rpm',label:string,unit:string,detail:string):Indicator=>{
   const value=get(key),points=series(key);
   return {key,label,value,unit,quality:stale?'stale':value===null?'unavailable':'valid',detail,alertLevel:null,
     ...(!stale&&value!==null&&points.length>=3?{trend:round(points[0]-points[points.length-1]),trendSeconds:round((Date.parse(recent.filter(sample=>sensorValue(sample.fields,key)!==null)[0].capturedAt)-Date.parse(recent.filter(sample=>sensorValue(sample.fields,key)!==null).at(-1)!.capturedAt))/1000)}:{})};
 };
 const indicators:Indicator[]=[
 metric('spo2','Saturación periférica estimada','%','MAX30102; requiere señal válida y buen contacto.'),
 metric('bpm_ecg','Frecuencia por ECG','lpm','AD8232; la frecuencia no equivale a interpretación de forma de onda.'),
 metric('bpm_oxi','Frecuencia por oxímetro','lpm','MAX30102; puede discrepar durante movimiento.'),
 metric('rpm','Frecuencia respiratoria estimada','rpm','Estimación mediante movimiento MPU6050; no es capnografía.')
 ];
 const mark=(key:string,alertLevel:'review'|'priority')=>{const indicator=indicators.find(value=>value.key===key);if(indicator?.quality==='valid')indicator.alertLevel=alertLevel;};
 let level:Level='observing';let title='Seguimiento de lecturas';const evidence:string[]=[];
 if(!latest){level='no_data';title='Sin datos para este escenario';}
 else if(stale){level='insufficient';title='Datos desactualizados';}
 else {
  const ox=series('spo2'),bpm=series('bpm_ecg'),resp=series('rpm');
  if(ox.length===0 || get('spo2')===null){level='sensor_issue';title='Sin lectura de oxígeno fiable';}
  if(get('spo2')!==null){
   const value=get('spo2')!;
   if(value<90){mark('spo2','priority');level='priority';title=`SpO₂ ${value} %: verificación prioritaria`;evidence.push(`Lectura más reciente SpO₂ ${value}% (aceptada por el formato del firmware; sin confirmación clínica).`);
    if(ox.length>=3&&ox.slice(0,3).every(v=>v<90))evidence.push('Tres instantáneas válidas recientes por debajo del umbral de demostración; pueden repetir una estimación del firmware.');
    }
   else if(value<95){mark('spo2','review');level='review';title='Revisar tendencia de oxigenación';evidence.push(`Última SpO₂ estimada ${value}%.`);}
   else evidence.push(`Última SpO₂ estimada ${value}%; sin alerta por la regla terrestre demostrativa.`);
  }
  if(get('bpm_ecg')!==null&&bpm.length>=5){
   const baseline=median(bpm.slice(2));const newer=median(bpm.slice(0,2));
   if(baseline!==null&&newer!==null&&Math.abs(newer-baseline)>=20){
    mark('bpm_ecg','review');
    evidence.push(`Cambio observado de pulso ECG ≈ ${round(newer-baseline)} lpm respecto a muestras recientes (NO referencia clínica personal).`);
    if(levelRank(level)<levelRank('review')){level='review';title='Cambio de frecuencia cardíaca a revisar';}

   }
  }
  const e=get('bpm_ecg'),o=get('bpm_oxi');
  if(e!==null&&o!==null&&Math.abs(e-o)>=20){
   mark('bpm_ecg','review');mark('bpm_oxi','review');
   evidence.push(`Discrepancia ECG/oxímetro de ${round(Math.abs(e-o))} lpm.`);
   if(levelRank(level)<levelRank('review')){level='review';title='Comprobar coherencia entre sensores';}

  }
  const oxPulseSamples=recent.filter(sample=>sensorValue(sample.fields,'bpm_oxi')!==null);
  const pulseJump=o!==null&&oxPulseSamples.length>=2&&Date.parse(oxPulseSamples[0].capturedAt)-Date.parse(oxPulseSamples[1].capturedAt)<=telemetryQualityRules.pulseJumpMaxSeconds*1000&&Math.abs(o-sensorValue(oxPulseSamples[1].fields,'bpm_oxi')!)>=telemetryQualityRules.pulseJumpLpm;
  if(o!==null&&(o===telemetryQualityRules.pulseFormatCeiling||pulseJump)){
   mark('bpm_oxi','review');
   const pulse=indicators.find(metric=>metric.key==='bpm_oxi')!;
   pulse.checkRequired=true;
   pulse.detail=o===telemetryQualityRules.pulseFormatCeiling
     ? `El oxímetro informa ${o} lpm, el límite superior del formato admitido. Esto no confirma la exactitud del pulso.`
     : `El pulso del oxímetro pasó de ${sensorValue(oxPulseSamples[1].fields,'bpm_oxi')} a ${o} lpm entre dos instantáneas recientes. La causa puede ser fisiológica o de captura; requiere contraste.`;
   evidence.push(pulse.detail);
   const oxygen=indicators.find(metric=>metric.key==='spo2')!;
   if(oxygen.value!==null){oxygen.checkRequired=true;oxygen.detail='MAX30102: el pulso del mismo sensor presenta un valor límite o un cambio brusco; contrastar también la SpO₂.';}
   if(levelRank(level)<levelRank('review')){level='review';title='Lectura del oxímetro a comprobar';}
  }
  if(get('rpm')!==null)evidence.push(`Respiración estimada ${get('rpm')} rpm; no permite diagnosticar trastornos respiratorios por sí sola.`);
  if(get('rpm')!==null&&resp.length>=3){const delta=round(resp[0]-resp[resp.length-1]);if(Math.abs(delta)>=6)evidence.push(`Variación de respiración estimada de ${delta} rpm durante la ventana observada; comprobar artefactos de movimiento.`);}
  if(recent.length<3 && level==='observing'){level='insufficient';title='Historial reciente insuficiente';}
 }
 const context:Record<string,string>={
  iss_leo:'La microgravedad y las condiciones de cabina pueden influir en el contexto; falta telemetría radiológica ISS en este paquete.',
  moon_surface:'Se seleccionó superficie lunar. La serie CRaTER proviene de ÓRBITA lunar; NO representa exposición personal ni condiciones internas del traje.',
  mars_surface:'Se seleccionó superficie marciana. MSL-RAD es un detector en Curiosity; NO representa la dosis recibida dentro de un traje.',
  deep_space_transit:'Se seleccionó tránsito espacial. EAD-MU01 midió en Orion durante Artemis I; NO representa una dosis personal universal.'
 };
 const explanation=(!latest?'Todavía no hay lecturas posteriores a la selección del escenario.':
  stale?'La señal más reciente no es actual. No se emitirán conclusiones fisiológicas basadas en datos antiguos.':
  level==='priority'?`El MAX30102 informa SpO₂ de ${get('spo2')} %. Confirma la lectura con un instrumento de uso médico y aplica las acciones prioritarias; el prototipo no permite determinar la causa.`:
  level==='sensor_issue'?'El oxímetro no proporciona una lectura válida; el estado de señal tiene prioridad sobre cualquier número mostrado.':
  level==='review'?'Se detectó un valor o cambio que conviene revisar y verificar con el contexto de actividad y la calidad del sensor.':
  'Las mediciones disponibles no activaron las reglas de advertencia demostrativas. Eso no significa que se hayan descartado todos los riesgos médicos.');
 const actions=telemetryActions({fields:latest?.fields,indicators,stale,count:recent.length});
 return {version:'dss-telemetry-2.2-demo',timestamp:now.toISOString(),
  scenario:{id:input.scenarioId,label:input.scenarioLabel,scope:input.scenarioScope,radiation:input.radiation,context:context[input.scenarioId]??"Sin referencia para este escenario."},
  state:{level,title,explanation,recommendations:actions.map(action=>`${action.title}: ${action.steps.join(" ")}${action.escalation?" "+action.escalation:""}`),actions,evidence},
  telemetry:{count:recent.length,latestAt:latest?.capturedAt??null,ageSeconds:age,indicators,lastReadingId:latest?.readingId??null,deviceId:latest?.deviceId??null},
  limitations:["Sistema de apoyo y demostración; no sustituye valoración médica ni está certificado para EVA.","Reglas de SpO₂ basadas en cribado terrestre; NO validadas para trajes, hipobaria ni exploración espacial.","Los datos históricos de radiación NO predicen cambios instantáneos en SpO₂, ECG o respiración.","El perfil ambiental describe referencias históricas, no sensores activos dentro del traje o de la cabina."]};
}
