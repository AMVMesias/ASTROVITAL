import type {NextRequest} from "next/server";
import {randomBytes} from "node:crypto";
import {services} from "../../../../../../backend/composition/services";
import {handle,json,requestSession,respond,sameOrigin} from "../../../../../../backend/transport/http";
import {object,only,text} from "../../../../../../backend/domain/validation";
import {AppError} from "../../../../../../backend/domain/model";
import {provisionDevice} from "../../../../../../backend/infrastructure/postgres/app/seed";
export const runtime="nodejs";
export function POST(request:NextRequest,context:{params:Promise<{id:string}>}){return handle(async()=>{
 sameOrigin(request);const admin=await requestSession(request,"admin"),app=services(),input=object(await json(request));only(input,["deviceId"]);
 const deviceId=text(input,"deviceId",1,64),{id}=await context.params;
 return app.repo.atomic(async()=>{
  await app.auth.requireSession(admin.sessionId,"admin");const user=await app.repo.account(id);
  if(!user?.enabled||user.role!=="astronauta"||!user.astronautId)throw new AppError(400,"VALIDATION","Selecciona un astronauta habilitado.");
  const previous=await app.repo.device(deviceId);
  if(previous){if(previous.astronautId!==user.astronautId)throw new AppError(409,"DEVICE_BINDING_CONFLICT","Ese ID pertenece a otro astronauta.");if(!previous.enabled)throw new AppError(409,"DEVICE_DISABLED","El dispositivo está inhabilitado.");}
  else await provisionDevice(app.repo,user.username,deviceId,randomBytes(32).toString("hex"));
  await app.repo.audit(admin.id,id,"browser_device_linked");return respond({deviceId,status:"linked"});
 });
});}
