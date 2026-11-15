import type { NextRequest } from "next/server";
import { services } from "../../../../../../backend/composition/services";
import { handle,json,respond,requestSession,sameOrigin } from "../../../../../../backend/transport/http";
import { object,only,text } from "../../../../../../backend/domain/validation";
import { AppError } from "../../../../../../backend/domain/model";
export const runtime="nodejs";
export function POST(request:NextRequest){return handle(async()=>{
  sameOrigin(request);const session=await requestSession(request,"astronauta");
  const input=object(await json(request));only(input,["deviceId","telemetry","measurement","signal"]);
  const deviceId=text(input,"deviceId",1,64);
  if(!input.telemetry&&!input.measurement&&!input.signal)throw new AppError(400,"VALIDATION","Falta una lectura o estado.");
  if(input.measurement&&input.signal)throw new AppError(400,"VALIDATION","Una lectura no puede tener dos estados.");
  const app=services();
  return app.repo.db.atomic(async()=>{
    await app.repo.get("SELECT id FROM devices WHERE id=? FOR UPDATE",deviceId);
    const telemetry=input.telemetry?await app.telemetry.capture(deviceId,session,input.telemetry):undefined;
    const measurement=input.measurement?await app.measurements.fromDevice(deviceId,session,input.measurement):undefined;
    if(input.signal)await app.measurements.reportStatus(deviceId,session,input.signal);
    const evaluation=measurement?await app.assessments.process(measurement.measurement.id):undefined;
    return respond({status:"recorded",telemetry,measurement,evaluation});
  },false);
});}
