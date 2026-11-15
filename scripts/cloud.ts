import { loadLocalEnvironment } from "./loadLocalEnvironment";
import { databasePool } from "../src/backend/src/backend/infrastructure/postgres/database";
import { withServices, services } from "../src/backend/src/backend/composition/services";
import { seed, provisionDevice } from "../src/backend/src/backend/infrastructure/postgres/app/seed";
loadLocalEnvironment();
async function main() {
  await withServices(async()=>{
    const app=services();
    if(process.argv[2]==="seed") {
      if(!process.env.ADMIN_PASSWORD) throw new Error("Configura ADMIN_PASSWORD (12 caracteres o más).");
      await seed(app.repo,process.env.ADMIN_USERNAME??"admin",process.env.ADMIN_PASSWORD);
      console.log("Catálogo y administrador preparados en Supabase; cuentas existentes conservadas.");
    } else if(process.argv[2]==="device") {
      if(!process.env.DEVICE_USERNAME||!process.env.DEVICE_TOKEN) throw new Error("Configura DEVICE_USERNAME y DEVICE_TOKEN.");
      await provisionDevice(app.repo,process.env.DEVICE_USERNAME,process.env.DEVICE_ID??"esp32-demo",process.env.DEVICE_TOKEN);
      console.log("Dispositivo provisionado.");
    } else throw new Error("Usa seed o device.");
  });
}
main().catch(()=>{console.error("No se pudo completar el aprovisionamiento. Revisa la configuración de Supabase y las credenciales requeridas.");process.exitCode=1;}).finally(()=>databasePool().end());
