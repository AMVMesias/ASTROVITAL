import {noticeTitle,type Notice} from "./presentation";
export function AlertExplanation({alert,es}:{alert:Notice;es:boolean}){
 const r=alert.reading,reference=alert.evidence.reference;
 const format=(value:number)=>value.toLocaleString(es?"es":"en",{maximumFractionDigits:1});
 const unit=r?.unit==="bpm"?"lpm":r?.unit==="score_1_5"?"/5":r?.unit??"";
 const delta=r&&reference?r.value-reference.mean:null;
 return <div>
  <h3>{noticeTitle(alert,es)}</h3>
  {r&&<p><strong>{es?"Lectura que activó el aviso: ":"Reading that triggered this alert: "}</strong>{format(r.value)} {unit} · {new Date(r.capturedAt).toLocaleString(es?"es":"en")}{r.origin==="simulated"&&(es?" · Simulada":" · Simulated")}</p>}
  {reference&&<p>{es?"Tu referencia: ":"Your baseline: "}{format(reference.mean)} {unit} ({reference.count} {es?"muestras":"samples"}). {delta!==null&&`${es?"Diferencia de esta lectura":"This reading's difference"}: ${delta>0?"+":""}${format(delta)} ${unit}.`}</p>}
  {alert.reason==="deviation"&&<p>{es?`La regla detectó ${alert.evidence.evidence?.length??"varias"} lecturas consecutivas con variación en el mismo sentido respecto a tu referencia personal.`:`The rule detected ${alert.evidence.evidence?.length??"multiple"} consecutive readings varying in the same direction from your personal baseline.`}</p>}
  <p><strong>{es?"Qué hacer ahora: ":"What to do next: "}</strong>{r?.indicator==="heart_rate"&&alert.reason==="deviation" ? (es?"Verifica el contacto del sensor y que la actividad seleccionada corresponda a lo que haces. Registra una nueva lectura y anota si hubo movimiento o esfuerzo reciente.":"Check sensor contact and that the selected activity matches what you are doing. Record a new reading and note any recent movement or effort.") : alert.evidence.recommendation?.message[es?"es":"en"]??(es?"Revisa la captura y registra una observación.":"Review the capture and record an observation.")}</p>
  <p>{es?"Este aviso señala un cambio para revisar; no identifica una enfermedad ni confirma tu estado general de salud.":"This alert flags a change to review; it does not identify a disease or confirm your overall health status."}</p>
 </div>;
}
