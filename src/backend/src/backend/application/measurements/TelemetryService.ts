import { AppError, type Session } from "../../domain/model";
import { object, only, text, date } from "../../domain/validation";
import { authorizeDevice } from "./deviceAccess";
import type { PostgresRepository } from "../../infrastructure/postgres/app/PostgresRepository";
import type { AuthService } from "../auth/AuthService";

export const telemetryFields = ["ecg","bpm_ecg","estado_ecg_x50","resp_mg","rpm","estado_resp_x50","spo2","bpm_oxi","estado_oxi_x50","ir","rojo"] as const;
type Fields = Record<typeof telemetryFields[number],number>;
export class TelemetryService {
  constructor(private repo:PostgresRepository, private auth:AuthService) {}
  async capture(deviceId:string, credential:string|Session, value:unknown) {
    return (await this.repo.atomic(async ()=>{
      const {device}=await authorizeDevice(this.repo,this.auth,deviceId,credential);
      const input=object(value);only(input,["readingId","capturedAt","fields"]);
      const readingId=text(input,"readingId",1,128), capturedAt=date(input.capturedAt,"capturedAt");
      if(Date.parse(capturedAt)>Date.now()+60000) throw new AppError(400,"VALIDATION","Fecha futura no admitida.");
      const raw=object(input.fields);only(raw,[...telemetryFields]);
      for(const field of telemetryFields) if(typeof raw[field]!=="number" || !Number.isFinite(raw[field]) || Math.abs(raw[field] as number)>1e9) throw new AppError(400,"VALIDATION","Once campos numéricos finitos requeridos.");
      const fields=Object.fromEntries(telemetryFields.map(field=>[field,raw[field]])) as Fields;
      if(![0,50,100].includes(fields.estado_ecg_x50) || ![0,50,100].includes(fields.estado_resp_x50) || ![0,50,100,150,200].includes(fields.estado_oxi_x50)) throw new AppError(400,"VALIDATION","Estado de sensor desconocido.");
      const encoded=JSON.stringify({readingId,capturedAt,fields});
      const previous=(await this.repo.get("SELECT payload FROM sensor_telemetry WHERE device_id=? AND reading_id=?",deviceId,readingId));
      if(previous) {
        if(previous.payload!==encoded) throw new AppError(409,"READING_CONFLICT","Identificador reutilizado con otro contenido.");
        return {status:"recorded",readingId,duplicate:true};
      }
      const receivedAt=new Date().toISOString();
      (await this.repo.run("INSERT INTO sensor_telemetry VALUES(?,?,?,?,?,?)",deviceId,readingId,device.astronautId,capturedAt,receivedAt,encoded));
      (await this.repo.touchDevice(deviceId,receivedAt));
      return {status:"recorded",readingId,duplicate:false};
    }));
  }
  async history(session:Session, params:URLSearchParams, latest=false) {
    const user=(await this.auth.requireSession(session.sessionId,"astronauta"));
    for(const key of params.keys()) if(!["field","from","to","limit","offset"].includes(key)) throw new AppError(400,"VALIDATION","Filtro desconocido.");
    const field=params.get("field");
    if(field && !telemetryFields.includes(field as typeof telemetryFields[number])) throw new AppError(400,"VALIDATION","Campo desconocido.");
    const limit=latest?1:Number(params.get("limit")??50), offset=latest?0:Number(params.get("offset")??0);
    if(!Number.isSafeInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(offset)||offset<0) throw new AppError(400,"VALIDATION","Paginación inválida.");
    const from=params.has("from")?date(params.get("from"),"from"):null, to=params.has("to")?date(params.get("to"),"to"):null;
    if(from&&to&&from>to) throw new AppError(400,"VALIDATION","Período inválido.");
    const samples=(await (await this.repo.all("SELECT * FROM sensor_telemetry WHERE astronaut_id=? AND (CAST(? AS TEXT) IS NULL OR captured_at>=?) AND (CAST(? AS TEXT) IS NULL OR captured_at<=?) ORDER BY captured_at DESC,device_id,reading_id DESC LIMIT ? OFFSET ?",user.astronautId!,from,from,to,to,limit,offset)).map(row=>{
      const payload=JSON.parse(String(row.payload)) as {readingId:string;capturedAt:string;fields:Fields};
      const f=payload.fields;
      return {...payload,deviceId:row.device_id,receivedAt:row.received_at,clock:"host_received_csv_snapshot",ageSeconds:Math.max(0,Math.floor((Date.now()-Date.parse(payload.capturedAt))/1000)),
        ...(field?{fields:{[field]:f[field as keyof Fields]}}:{}),
        sensors:{ecg:{state:f.estado_ecg_x50/50,bpm:f.estado_ecg_x50===100&&f.bpm_ecg>0&&f.bpm_ecg<=300?f.bpm_ecg:null},
          respiration:{state:f.estado_resp_x50/50,rpm:f.estado_resp_x50===100&&f.rpm>0&&f.rpm<=60?f.rpm:null},
          oximeter:{state:f.estado_oxi_x50/50,spo2:f.estado_oxi_x50>=150&&f.spo2>0&&f.spo2<=100?f.spo2:null,bpm:f.estado_oxi_x50===200&&f.bpm_oxi>0&&f.bpm_oxi<=300?f.bpm_oxi:null}}};
    }));
    return {samples,availableFields:telemetryFields};
  }
}
