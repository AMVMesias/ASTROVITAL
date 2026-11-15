export const fieldNames=["ecg","bpm_ecg","estado_ecg_x50","resp_mg","rpm","estado_resp_x50","spo2","bpm_oxi","estado_oxi_x50","ir","rojo"] as const;
export type TelemetryFields=Record<typeof fieldNames[number],number>;
export type CapturePacket={telemetry?:{readingId:string;capturedAt:string;fields:TelemetryFields};measurement?:{readingId:string;indicator:"heart_rate";value:number;unit:"bpm";capturedAt:string;activity:"rest"|"exercise"|"eva"|"unknown";note:string};signal?:{status:string;observedAt:string}};
export class BleFrames {
  private buffer=new Uint8Array(0);private pending:Uint8Array|null=null;
  constructor(private copies:1|2=1){}
  reset(){this.buffer=new Uint8Array(0);this.pending=null;}
  feed(bytes:Uint8Array):string[]{
    if(this.copies===2){if(!this.pending){this.pending=bytes.slice();return [];}
      const previous=this.pending;this.pending=null;
      if(previous.length!==bytes.length||previous.some((v,i)=>v!==bytes[i])){this.reset();throw new Error("Los fragmentos no llegan duplicados. Revisa la configuración BLE.");}}
    const next=new Uint8Array(this.buffer.length+bytes.length);next.set(this.buffer);next.set(bytes,this.buffer.length);
    if(next.length>16384){this.reset();throw new Error("Trama BLE superior a 16 KiB.");}
    const lines:string[]=[];let start=0;
    try{for(let i=0;i<next.length;i++)if(next[i]===10){lines.push(new TextDecoder("utf-8",{fatal:true}).decode(next.subarray(start,i)).trim());start=i+1;}}
    catch{this.reset();throw new Error("La trama BLE no es UTF-8 válido.");}
    this.buffer=next.slice(start);return lines.filter(Boolean);
  }
}
export function decodeCsv(line:string,readingId:string,capturedAt:string,activity:"rest"|"exercise"|"eva"|"unknown"):CapturePacket {
  const columns=line.split(",");
  if(columns.length!==11||columns.some(v=>!v.trim()||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(v.trim())))throw new Error("Se esperan once columnas CSV numéricas.");
  const values=columns.map(Number);
  if(values.some(v=>!Number.isFinite(v)||Math.abs(v)>1e9)||![0,50,100].includes(values[2])||![0,50,100].includes(values[5])||![0,50,100,150,200].includes(values[8]))throw new Error("Valor o estado de sensor inválido.");
  const fields=Object.fromEntries(fieldNames.map((name,i)=>[name,values[i]])) as TelemetryFields;
  const bpm=fields.bpm_ecg,state=fields.estado_ecg_x50;
  if(state===100&&bpm>0&&(bpm<1||bpm>300))throw new Error("Pulso fuera de formato (1–300 bpm).");
  return {telemetry:{readingId:readingId+":telemetry",capturedAt,fields},
    ...(state===100&&bpm>0?{measurement:{readingId,indicator:"heart_rate",value:bpm,unit:"bpm",capturedAt,activity,note:"AD8232; clock=host_received_csv_snapshot"}}:
    {signal:{status:state===0?"no_contact":state===50?"no_signal":"insufficient",observedAt:capturedAt}})};
}
