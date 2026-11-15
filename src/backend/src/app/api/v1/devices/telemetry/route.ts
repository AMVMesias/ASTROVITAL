import type { NextRequest } from "next/server";
import { localServices } from "../../../../../backend/composition/local";
import { handle,json,respond } from "../../../../../backend/transport/http";
import { AppError } from "../../../../../backend/domain/model";
export const runtime="nodejs";
export function POST(request:NextRequest) {
  return handle(async()=>{
    const authorization=request.headers.get("authorization")??"";
    if(!authorization.startsWith("Bearer ") || authorization.length>300) throw new AppError(401,"DEVICE_UNAUTHORIZED","Usa la credencial Bearer del dispositivo.");
    return respond(localServices().telemetry.capture(request.headers.get("x-device-id")??"",authorization.slice(7),await json(request)));
  });
}
