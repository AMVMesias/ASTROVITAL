import { AppError, type Session } from "../../domain/model";
import type { Repository } from "../../domain/repository";
import type { AuthService } from "../auth/AuthService";
import { digest } from "../../infrastructure/security/credentials";

/** Browser capture uses the verified account, never a device secret in the bundle. */
export async function authorizeDevice(repo:Repository,auth:AuthService,id:string,credential:string|Session) {
  const device=await repo.device(id);
  if(!device?.enabled)throw new AppError(401,"DEVICE_UNAUTHORIZED","Dispositivo no disponible.");
  if(typeof credential!=="string") {
    const user=await auth.requireSession(credential.sessionId,"astronauta");
    if(user.astronautId!==device.astronautId)throw new AppError(403,"FORBIDDEN","El dispositivo no está vinculado a tu cuenta.");
    return {device,user};
  }
  if(digest(credential)!==device.credentialHash)throw new AppError(401,"DEVICE_UNAUTHORIZED","Credencial del dispositivo inválida.");
  const user=(await repo.users()).find(u=>u.astronautId===device.astronautId);
  if(!user?.enabled||user.role!=="astronauta"||user.requiresOnboarding)throw new AppError(403,"DEVICE_OWNER_UNAVAILABLE","Cuenta vinculada no disponible.");
  return {device,user};
}
