import { NextRequest } from "next/server";
import { services } from "../../../../../backend/composition/services";
import { handle, respond, requestSession, sameOrigin, json } from "../../../../../backend/transport/http";
import { randomBytes } from "node:crypto";
import { digest } from "../../../../../backend/infrastructure/security/credentials";
import { provisionDevice } from "../../../../../backend/infrastructure/postgres/app/seed";
import { object, only } from "../../../../../backend/domain/validation";
import { AppError } from "../../../../../backend/domain/model";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return handle(async () => {
  const app=services(), session=(await requestSession(request,"astronauta"));
  const devices=await app.repo.devices(session.astronautId!);
  const telemetry=(await app.telemetry.history(session,new URLSearchParams(),true)).samples[0]??null;
  return respond({devices,telemetry});
}); }

/** A browser capture channel belongs to the session owner; no MAC or device secret is needed. */
export function POST(request: NextRequest) { return handle(async () => {
  sameOrigin(request);
  const app=services(), session=await requestSession(request,"astronauta");
  only(object(await json(request)),[]);
  return app.repo.atomic(async()=>{
    const user=await app.auth.requireSession(session.sessionId,"astronauta");
    const deviceId=`browser-${digest(user.id).slice(0,32)}`;
    const existing=await app.repo.device(deviceId);
    if(existing && (existing.astronautId!==user.astronautId || !existing.enabled))
      throw new AppError(409,"DEVICE_UNAVAILABLE","El canal de captura está inhabilitado o no está disponible.");
    if(!existing) {
      await provisionDevice(app.repo,user.username,deviceId,randomBytes(32).toString("hex"));
      await app.repo.audit(user.id,user.id,"browser_device_self_linked");
    }
    return respond({deviceId,status:"linked"});
  });
}); }
