import { NextRequest } from "next/server";
import { services } from "../../../../backend/composition/services";
import { AppError } from "../../../../backend/domain/model";
import { handle, respond, json } from "../../../../backend/transport/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: NextRequest) { return handle(async () => {
 const id=request.headers.get("x-device-id") ?? "";
 const authorization=request.headers.get("authorization") ?? "";
 if (!authorization.startsWith("Bearer ") || authorization.length>300) throw new AppError(401,"DEVICE_UNAUTHORIZED","Usa Bearer con la credencial del dispositivo.");
 const result=(await services().measurements.fromDevice(id,authorization.slice(7),await json(request)));
 return respond({...result,evaluation:await services().assessments.process(result.measurement.id)},result.duplicate?200:201);
}); }
