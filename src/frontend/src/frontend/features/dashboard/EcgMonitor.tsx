"use client";
import Link from "next/link";
import {useEffect,useId,useState} from "react";
import {useLiveEcg} from "../capture/BleCapture";
import {ecgSegments} from "../capture/ecgStream";
import styles from "./ecgMonitor.module.css";

export function EcgMonitor({locale,alert=false}:{locale:string;alert?:boolean}) {
 const es=locale==="es",stream=useLiveEcg(),grid=useId().replaceAll(":","");
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[]);
 const latest=stream.points.at(-1);
 const clock=Math.max(now,latest?.time??now);
 const recent=!!latest&&clock-latest.time<=3000;
 const live=stream.connected&&recent&&latest.contact;
 const segments=live?ecgSegments(stream.points,clock):[];
 const amplitude=Math.max(160,...segments.flatMap(segment=>segment.map(point=>Math.abs(point.value))));
 const x=(time:number)=>((time-(clock-10000))/10000)*1000;
 const y=(value:number)=>120-value/amplitude*95;
 const duration=latest&&stream.points.length>1?latest.time-stream.points[0].time:0;
 const rate=duration>0?Math.round((stream.points.length-1)*1000/duration):null;
 const state=!stream.connected?(es?"Sin captura BLE en esta pestaña":"No BLE capture in this tab"):!latest?(es?"Esperando señal":"Waiting for signal"):!recent?(es?"Sin datos recientes":"No recent data"):!latest.contact?(es?"Sin contacto de electrodos":"Electrodes disconnected"):(es?"Señal recibida en vivo":"Live received signal");
 return <section className={`${styles.panel} ${alert&&live?styles.alert:""}`} aria-label={es?"Monitor de señal ECG":"ECG signal monitor"}>
  <header><div><p className={styles.eyebrow}>AD8232 · BLE</p><h2>{es?"Monitor de señal ECG":"ECG signal monitor"}</h2></div><span className={styles.status}>{state}</span></header>
  <div className={styles.chart}>
   <svg viewBox="0 0 1000 240" preserveAspectRatio="none" role="img" aria-label={es?"Señal ECG cruda recibida en los últimos diez segundos":"Raw ECG signal received over the last ten seconds"}>
    <defs><pattern id={grid} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" strokeWidth=".5"/></pattern></defs>
    <rect width="1000" height="240" fill={`url(#${grid})`}/>
    {segments.map((segment,index)=>segment.length>1?<polyline key={index} data-ecg-trace="true" fill="none" stroke="var(--ecg-line)" strokeWidth="2" strokeLinejoin="round" points={segment.map(point=>`${x(point.time).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ")}/>:null)}
   </svg>
   {!live&&<p className={styles.overlay}>{state}</p>}
  </div>
  <div className={styles.meta}><span>−10 s</span><span>{es?"Escala automática · unidades crudas":"Automatic scale · raw units"}</span><span>{es?"Ahora":"Now"}</span></div>
  <p className={styles.caption}>{live?`${es?"Recepción observada":"Observed reception"}: ${rate??"—"} ${es?"muestras/s":"samples/s"} · ${es?"último valor":"latest value"}: ${latest?.value}`:(es?"Conecta la placa desde Bluetooth para ver la onda recibida en esta pestaña.":"Connect the board from Bluetooth to view the waveform received in this tab.")}</p>
  {alert&&live&&<p role="alert" className={styles.alertText}>{es?"Alerta de frecuencia cardíaca según la regla vigente; verificar lectura y contexto.":"Heart-rate alert under the current rule; verify reading and context."}</p>}
  <footer><small>{es?"Vista de monitor de la señal transmitida por BLE, no un ECG diagnóstico. No se reconstruyen ondas a partir de las instantáneas de 1 Hz de la API.":"Monitor view of the signal transmitted over BLE, not a diagnostic ECG. No waveforms are reconstructed from the API’s 1 Hz snapshots."}</small><Link href="/bluetooth">{es?"Abrir Bluetooth":"Open Bluetooth"} →</Link></footer>
 </section>;
}
