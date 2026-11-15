"use client";
import Link from "next/link";
import {useEffect,useId,useState} from "react";
import {useLiveEcg} from "../capture/BleCapture";
import {ecgSegments,filterEcg,hasValidatedPulse,validatedEcgSegments} from "../capture/ecgStream";
import styles from "./ecgMonitor.module.css";

export function EcgMonitor({locale,alert=false}:{locale:string;alert?:boolean}) {
 const es=locale==="es",stream=useLiveEcg(),grid=useId().replaceAll(":","");
 const [now,setNow]=useState(()=>Date.now()),[raw,setRaw]=useState(false);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[]);
 const latest=stream.points.at(-1),clock=Math.max(now,latest?.time??now);
 const recent=!!latest&&clock-latest.time<=3000,live=stream.connected&&recent&&latest.contact;
 const pulseValid=hasValidatedPulse(latest);
 const segments=live?(raw?ecgSegments(stream.points,clock):validatedEcgSegments(stream.points,clock).map(filterEcg)):[];
 const drawable=live&&(raw||pulseValid)&&segments.some(segment=>segment.length>=3);
 const amplitude=Math.max(300,...segments.flatMap(segment=>segment.map(point=>Math.abs(point.value)*1.1)));
 const x=(time:number)=>((time-(clock-10000))/10000)*1000;
 const y=(value:number)=>100-value/amplitude*78;
 const duration=latest&&stream.points.length>1?latest.time-stream.points[0].time:0;
 const rate=duration>0?Math.round((stream.points.length-1)*1000/duration):null;
 const state=!stream.connected?(es?"Sin captura en esta pestaña":"No capture in this tab"):!latest?(es?"Esperando señal":"Waiting for signal"):!recent?(es?"Sin datos recientes":"No recent data"):!latest.contact?(es?"Sin contacto":"No contact"):!pulseValid?(raw?(es?"Señal cruda · FC no disponible":"Raw signal · HR unavailable"):(es?"Señal sin validar · FC no disponible":"Unvalidated signal · HR unavailable")):raw?(es?"Señal cruda · pulso recibido":"Raw signal · pulse received"):!drawable?(es?"Estabilizando señal filtrada":"Stabilizing filtered signal"):(es?"Vista filtrada · pulso recibido":"Filtered display · pulse received");
 return <div className={`${styles.monitor} ${raw?styles.raw:""} ${alert&&drawable&&pulseValid?styles.alert:""}`} role="group" aria-label={es?"Señal ECG en evaluación actual":"ECG signal in current assessment"}>
  <div className={styles.toolbar}><span className={styles.label}>ECG · AD8232</span><span className={styles.status}>{state}</span></div>
  <div className={styles.chart}>
   <svg viewBox="0 0 1000 200" preserveAspectRatio="none" role="img" aria-label={es?"Señal ECG recibida durante los últimos diez segundos":"Received ECG signal over the last ten seconds"}>
    <defs>
     <pattern id={`${grid}-small`} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#eab4b9" strokeWidth=".6"/></pattern>
     <pattern id={grid} width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill={`url(#${grid}-small)`}/><path d="M50 0H0V50" fill="none" stroke="#d98d96" strokeWidth="1"/></pattern>
    </defs>
    <rect width="1000" height="200" fill={`url(#${grid})`}/>
    {drawable&&segments.map((segment,index)=>segment.length>1?<polyline key={index} data-ecg-trace="true" fill="none" stroke="var(--ecg-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={segment.map(point=>`${x(point.time).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ")}/>:null)}
   </svg>
   {!drawable&&<p className={styles.overlay}>{state}</p>}
  </div>
  <div className={styles.meta}><span>−10 s</span><span>{live?`${rate??"—"} ${es?"muestras/s":"samples/s"}`:"ECG"}</span><span>{es?"Ahora":"Now"}</span></div>
  <div className={styles.controls}><label><input type="checkbox" checked={raw} onChange={event=>setRaw(event.target.checked)}/>{es?"Mostrar señal cruda":"Show raw signal"}</label><span>{raw?(es?"Sin filtrar · unidades crudas":"Unfiltered · raw units"):(es?"Filtro visual · escala automática":"Display filter · automatic scale")}</span></div>
  {live&&!pulseValid&&<p className={styles.caption}>{raw?(es?"Estos voltajes no tienen pulso validado por el firmware. La curva cruda puede contener ruido y no representa latidos confirmados.":"These voltages have no firmware-validated pulse. The raw curve may contain noise and does not represent confirmed beats."):(es?"El ESP32 todavía no informa un pulso válido. La vista filtrada espera esa validación; puedes inspeccionar los voltajes con Mostrar señal cruda.":"The ESP32 has not reported a valid pulse yet. The filtered view waits for validation; inspect voltages with Show raw signal.")}</p>}
  {alert&&drawable&&pulseValid&&<p role="alert" className={styles.alertText}>{es?"Alerta de frecuencia cardíaca: verificar lectura y contexto.":"Heart-rate alert: verify reading and context."}</p>}
  <div className={styles.footer}><small>{es?"Vista de señal BLE, no ECG diagnóstico. El filtro no cambia las lecturas guardadas ni calcula latidos.":"BLE signal view, not a diagnostic ECG. The filter does not change saved readings or calculate beats."}</small>{!stream.connected&&<Link href="/bluetooth">{es?"Conectar placa":"Connect board"} →</Link>}</div>
 </div>;
}
