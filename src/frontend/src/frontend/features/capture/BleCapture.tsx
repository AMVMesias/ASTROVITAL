"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {api,ApiError,writeRequest} from "../../lib/api";
import {BleFrames,decodeCsv,type CapturePacket,type TelemetryFields} from "./protocol";
type Characteristic=EventTarget&{value?:DataView;startNotifications():Promise<Characteristic>;stopNotifications():Promise<Characteristic>};
type Gatt={connected:boolean;connect():Promise<Gatt>;disconnect():void;getPrimaryService(uuid:string):Promise<{getCharacteristic(uuid:string):Promise<Characteristic>}>};
type BleDevice=EventTarget&{name?:string;gatt?:Gatt};
type Bluetooth={requestDevice(options:{acceptAllDevices:true;optionalServices:string[]}):Promise<BleDevice>};
type Activity="rest"|"exercise"|"eva"|"unknown";
type Options={deviceId:string;service:string;characteristic:string;copies:1|2};
type View={state:string;error:string;received:number;confirmed:number;dropped:number;pending:number;fields?:TelemetryFields;capturedAt?:string;name?:string};
type Capture={view:View;activity:Activity;setActivity(activity:Activity):void;connect(options:Options):Promise<void>;disconnect():void};
const Context=createContext<Capture|null>(null);
export function BleCaptureProvider({children}:{children:ReactNode}){
 const [view,setView]=useState<View>({state:"Desconectado",error:"",received:0,confirmed:0,dropped:0,pending:0});
 const [activity,setActivityState]=useState<Activity>("unknown");
 const activityRef=useRef<Activity>("unknown");
 function setActivity(value:Activity){activityRef.current=value;setActivityState(value);}
 const active=useRef(false),mounted=useRef(true),device=useRef<BleDevice|null>(null),release=useRef<(()=>void)|null>(null),disconnectHandler=useRef<(()=>void)|null>(null);
 const captureDeviceId=useRef<string|null>(null);
 const queue=useRef<{deviceId:string;packet:CapturePacket;attempts:number}[]>([]),sending=useRef(false),generation=useRef(0);
 function patch(update:Partial<View>){if(mounted.current)setView(v=>({...v,...update}));}
 function stop(){const id=captureDeviceId.current;captureDeviceId.current=null;if(id)void api("/v1/me/device/capture",{...writeRequest("POST",{deviceId:id,signal:{status:"disconnected",observedAt:new Date().toISOString()}}),keepalive:true}).catch(()=>{});active.current=false;generation.current++;if(device.current&&disconnectHandler.current)device.current.removeEventListener("gattserverdisconnected",disconnectHandler.current);device.current?.gatt?.disconnect();device.current=null;release.current?.();release.current=null;const lost=queue.current.length;queue.current=[];if(mounted.current)setView(v=>({...v,state:"Desconectado",pending:0,dropped:v.dropped+lost}));}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop();};},[]);
 async function send(){
  if(sending.current)return;sending.current=true;const run=generation.current;
  try{while(active.current&&queue.current.length&&run===generation.current){
   const next=queue.current[0];
   try{await api("/v1/me/device/capture",{...writeRequest("POST",{deviceId:next.deviceId,...next.packet}),signal:AbortSignal.timeout(10000)});
    if(run!==generation.current)return;
    queue.current.shift();setView(v=>({...v,confirmed:v.confirmed+1,pending:queue.current.length,error:""}));
    window.dispatchEvent(new Event("astrovital:measurement"));
   }catch(error){
    if(run!==generation.current)return;
    if(error instanceof ApiError&&![408,425,429].includes(error.status)&&error.status<500){stop();patch({error:error.message});return;}
    next.attempts++;patch({error:"No se confirmó el envío. Reintentando; no cierres esta página."});
    if(next.attempts>=3){queue.current.shift();setView(v=>({...v,dropped:v.dropped+1,pending:queue.current.length}));}
    await new Promise(resolve=>setTimeout(resolve,Math.min(4000,next.attempts*1000)));
   }
  }}finally{sending.current=false;if(active.current&&queue.current.length)void send();}
 }
 async function connect(options:Options){
  if(active.current)return;
  const bluetooth=(navigator as Navigator&{bluetooth?:Bluetooth}).bluetooth;
  if(!window.isSecureContext||!bluetooth){patch({error:"Web Bluetooth no está disponible. Usa HTTPS y un navegador/sistema compatible (por ejemplo Chrome o Edge en Windows)."});return;}
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(options.service)||!uuid.test(options.characteristic)){patch({error:"Introduce UUID completos válidos."});return;}
  const attempt=++generation.current;active.current=true;patch({state:"Seleccionando dispositivo…",error:""});
  try{
   // The chooser must open directly from the user's click, before other awaited work.
   const selected=await bluetooth.requestDevice({acceptAllDevices:true,optionalServices:[options.service]});
   if(!active.current||attempt!==generation.current)return;
   if(!options.deviceId){
    const linked=await api<{deviceId:string}>("/v1/me/device",writeRequest("POST",{}));
    if(!active.current||attempt!==generation.current)return;
    options={...options,deviceId:linked.deviceId};
   }
   if(navigator.locks)await new Promise<void>((resolve,reject)=>{void navigator.locks.request("astrovital-ble-capture",{ifAvailable:true},async lock=>{
    if(!lock){reject(new Error("Otra pestaña de AstroVital ya está capturando. Desconéctala primero."));return;}
    resolve();await new Promise<void>(done=>{release.current=done;});
   }).catch(reject);});
   if(!active.current||attempt!==generation.current){release.current?.();release.current=null;return;}
   device.current=selected;patch({state:"Conectando…",name:selected.name??"ESP32"});
   const disconnected=()=>{if(attempt!==generation.current)return;stop();patch({error:"Se perdió la conexión Bluetooth. Revisa la placa y vuelve a conectar."});};
   disconnectHandler.current=disconnected;selected.addEventListener("gattserverdisconnected",disconnected);
   const gatt=await selected.gatt?.connect();if(attempt!==generation.current){selected.gatt?.disconnect();return;}if(!gatt)throw new Error("La placa no ofrece una conexión GATT disponible.");
   const service=await gatt.getPrimaryService(options.service),characteristic=await service.getCharacteristic(options.characteristic);
   const frames=new BleFrames(options.copies),boot=crypto.randomUUID();let sequence=0,lastSample=-Infinity;
   characteristic.addEventListener("characteristicvaluechanged",()=>{
    if(!active.current||attempt!==generation.current)return;const value=characteristic.value;if(!value)return;
    try{for(const line of frames.feed(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))){
     if(performance.now()-lastSample<1000)continue;
     const capturedAt=new Date().toISOString(),packet=decodeCsv(line,`${boot}:${++sequence}`,capturedAt,activityRef.current);lastSample=performance.now();
     setView(v=>({...v,state:"Capturando",fields:packet.telemetry?.fields,capturedAt,received:v.received+1}));
     if(queue.current.length>=10){setView(v=>({...v,dropped:v.dropped+1}));continue;}
     queue.current.push({deviceId:options.deviceId,packet,attempts:0});patch({pending:queue.current.length});void send();
    }}catch(error){patch({error:error instanceof Error?error.message:"Trama BLE inválida."});}
   });
   await characteristic.startNotifications();if(!active.current||attempt!==generation.current){selected.gatt?.disconnect();return;}
   captureDeviceId.current=options.deviceId;patch({state:"Conectado · esperando lecturas"});
  }catch(error){if(attempt!==generation.current)return;stop();patch({error:error instanceof Error?error.message:"No se pudo conectar por Bluetooth."});}
 }
 return <Context.Provider value={{view,activity,setActivity,connect,disconnect:stop}}>{children}</Context.Provider>;
}
export function BleCaptureCard(){
 const capture=useContext(Context);const [devices,setDevices]=useState<{id:string;enabled:boolean}[]>([]),[loadError,setLoadError]=useState("");
 useEffect(()=>{let active=true;void api<{devices:{id:string;enabled:boolean}[]}>("/v1/me/device").then(r=>{if(active)setDevices(r.devices.filter(d=>d.enabled));}).catch(e=>{if(active)setLoadError(e.message);});return()=>{active=false;};},[]);
 if(!capture)return null;const {view}=capture,busy=view.state!=="Desconectado";
 return <section className="ble-capture" aria-labelledby="ble-title"><h2 id="ble-title">ESP32 por Bluetooth</h2>
 <p role="status">{view.state}{view.name?` · ${view.name}`:""}</p>
 <p>Conecta la placa desde esta laptop. Mantén la página abierta y el equipo activo durante la captura.</p>
 {(loadError||view.error)&&<p role="alert">{loadError||view.error}</p>}
 {!devices.length&&!loadError&&<p>Pulsa Conectar ESP32 y selecciona tu placa. El vínculo con tu cuenta se crea automáticamente.</p>}
 <form className="data-form" onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);void capture.connect({deviceId:String(f.get("deviceId")??""),service:String(f.get("service")).trim(),characteristic:String(f.get("characteristic")).trim(),copies:Number(f.get("copies")) as 1|2});}}>
 <label>Actividad confirmada<select name="activity" value={capture.activity} onChange={event=>capture.setActivity(event.target.value as Activity)}><option value="unknown">No confirmada</option><option value="rest">Reposo confirmado</option><option value="exercise">Ejercicio</option><option value="eva">EVA</option></select></label>
 <p>Puedes cambiar la actividad sin desconectar. Se aplica a las próximas lecturas; las anteriores y los envíos pendientes conservan su actividad.</p>
 <fieldset disabled={busy}>{devices.length>0&&<label>Dispositivo vinculado<select name="deviceId">{devices.map(d=><option key={d.id}>{d.id}</option>)}</select></label>}
 <details><summary>Configuración BLE (la misma que Python)</summary><p>Formato CSV de once columnas, terminado en salto de línea.</p>
 <label>UUID del servicio<input name="service" required defaultValue="6e400001-b5a3-f393-e0a9-e50e24dcca9e"/></label>
 <label>UUID de la característica<input name="characteristic" required defaultValue="6e400003-b5a3-f393-e0a9-e50e24dcca9e"/></label>
 <label>Copias de cada fragmento<select name="copies"><option value="1">Una (normal)</option><option value="2">Dos (solo si la placa duplica cada fragmento)</option></select></label></details>
 </fieldset><div><button disabled={busy}>Conectar ESP32</button> <button type="button" disabled={!busy} onClick={capture.disconnect}>Desconectar</button></div>
 </form>
 <p>Recibidas: {view.received} · Confirmadas en Supabase: {view.confirmed} · Pendientes: {view.pending} · Sin confirmar: {view.dropped}</p>
 <p>Se guarda como máximo una instantánea por segundo. Los pendientes solo viven en memoria y se pierden al cerrar la captura.</p>
 {view.fields&&<><h3>Telemetría cruda</h3><p>Última recepción: <time dateTime={view.capturedAt}>{new Date(view.capturedAt!).toLocaleTimeString()}</time></p><dl className="ble-readings">{Object.entries(view.fields).map(([key,value])=><div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd>{value}</dd></div>)}</dl></>}
 </section>;
}
