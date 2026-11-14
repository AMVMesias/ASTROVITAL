import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteRepository } from "../src/backend/infrastructure/sqlite/SqliteRepository";
import { provisionDevice, seed } from "../src/backend/infrastructure/sqlite/seed";
import { createServices } from "../src/backend/composition/local";
import { AppError, type EnvironmentContext, type EnvironmentProvider } from "../src/backend/domain/model";
import { MeasurementService } from "../src/backend/application/measurements/MeasurementService";

const credential = "test-password-strong-123";
const deviceToken = "test-device-token-000000000000000000001";
const capturedAt = "2026-01-01T08:00:00.000Z";
const manual = { indicator: "sleep", value: 7.5, unit: "h", capturedAt };
const pulse = { indicator: "heart_rate", value: 68, unit: "bpm", capturedAt, readingId: "boot01-1" };
const errorCode = (code: string) => (error: unknown) => error instanceof AppError && error.code === code;
function fixture(path = ":memory:") {
  const repo = new SqliteRepository(path); seed(repo,"admin",credential);
  const services = createServices(repo);
  const adminLogin = services.auth.login({ username: "admin", password: credential });
  const admin = services.auth.session(adminLogin.token);
  const a = services.users.save(admin,{ username: "astro-a", name: "Astronauta A", role: "astronauta", password: credential });
  const b = services.users.save(admin,{ username: "astro-b", name: "Astronauta B", role: "astronauta", password: credential });
  const loginA = services.auth.login({ username: a.username, password: credential });
  const loginB = services.auth.login({ username: b.username, password: credential });
  return { ...services, admin, a, b, loginA, loginB, sessionA: services.auth.session(loginA.token), sessionB: services.auth.session(loginB.token) };
}

test("semillas y migraciones repetibles; contraseñas/tokens no se guardan en claro", () => {
  const f=fixture();
  try {
    seed(f.repo,"admin",credential);
    assert.equal(f.repo.users().length,3);
    assert.equal(f.repo.all("SELECT * FROM schema_migrations").length,1);
    assert.notEqual(f.repo.account(f.admin.id)!.passwordHash,credential);
    assert.equal(f.repo.session(f.loginA.token),null);
    assert.equal(JSON.stringify(f.users.list(f.admin)).includes("passwordHash"),false);
    assert.equal(JSON.stringify(f.users.list(f.admin)).includes("sessionId"),false);
  } finally { f.repo.close(); }
});
test("login inválido, bloqueo temporal, caducidad y logout revocan acceso", () => {
  const f=fixture();
  try {
    for(let i=0;i<5;i++) assert.throws(()=>f.auth.login({username:"unknown",password:"invalid"}),errorCode("INVALID_CREDENTIALS"));
    assert.throws(()=>f.auth.login({username:"unknown",password:"invalid"}),errorCode("LOGIN_THROTTLED"));
    f.repo.run("UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?",f.sessionA.sessionId);
    assert.throws(()=>f.auth.session(f.loginA.token),errorCode("UNAUTHENTICATED"));
    f.auth.logout(f.sessionB);
    assert.throws(()=>f.auth.session(f.loginB.token),errorCode("UNAUTHENTICATED"));
  } finally { f.repo.close(); }
});
test("cuentas: duplicados, edición básica, último admin y cambio de rol conservan perfil", () => {
  const f=fixture();
  try {
    assert.throws(()=>f.users.save(f.admin,{username:f.a.username,name:"Duplicate",role:"admin",password:credential}),errorCode("USERNAME_EXISTS"));
    assert.throws(()=>f.users.save(f.admin,{enabled:false},f.admin.id),errorCode("LAST_ADMIN"));
    const updated=f.users.save(f.admin,{name:"Nombre corregido"},f.a.id);
    assert.equal(updated.name,"Nombre corregido");
    f.users.save(f.admin,{role:"admin"},f.a.id);
    assert.throws(()=>f.measurements.manual(f.sessionA,manual),errorCode("UNAUTHENTICATED"));
    const restored=f.users.save(f.admin,{role:"astronauta"},f.a.id);
    assert.equal(restored.astronautId,f.a.astronautId);
    assert.ok(f.repo.all("SELECT * FROM audit WHERE target_id=?",f.a.id).length>=3);
  } finally { f.repo.close(); }
});
test("inhabilitar y cambiar credencial revocan sesiones previas y bloquean nuevo login", () => {
  const f=fixture();
  try {
    f.measurements.manual(f.sessionA,manual);
    f.users.save(f.admin,{enabled:false},f.a.id);
    assert.throws(()=>f.auth.session(f.loginA.token),errorCode("UNAUTHENTICATED"));
    assert.throws(()=>f.auth.login({username:f.a.username,password:credential}),errorCode("INVALID_CREDENTIALS"));
    f.users.save(f.admin,{enabled:true,password:"new-password-strong-123"},f.a.id);
    const fresh=f.auth.session(f.auth.login({username:f.a.username,password:"new-password-strong-123"}).token);
    assert.equal(f.measurements.history(fresh,new URLSearchParams()).length,1);
    assert.throws(()=>f.auth.session(f.loginA.token),errorCode("UNAUTHENTICATED"));
  } finally { f.repo.close(); }
});
test("servidor aísla roles y astronautas sin aceptar dueño del cliente", () => {
  const f=fixture();
  try {
    assert.throws(()=>f.users.list(f.sessionA),errorCode("FORBIDDEN"));
    assert.throws(()=>f.users.save(f.sessionA,{enabled:false},f.b.id),errorCode("FORBIDDEN"));
    assert.throws(()=>f.measurements.history(f.admin,new URLSearchParams()),errorCode("FORBIDDEN"));
    assert.throws(()=>f.measurements.summary(f.admin),errorCode("FORBIDDEN"));
    assert.throws(()=>f.measurements.manual(f.sessionA,{...manual,astronautId:f.b.astronautId}),errorCode("VALIDATION"));
    const saved=f.measurements.manual(f.sessionA,manual).measurement;
    assert.equal(saved.astronautId,f.a.astronautId);
    assert.equal(f.measurements.history(f.sessionB,new URLSearchParams()).length,0);
    assert.throws(()=>f.measurements.history(f.sessionB,new URLSearchParams({astronautId:f.a.astronautId!})),errorCode("VALIDATION"));
  } finally { f.repo.close(); }
});
test("validación rechaza indicador/unidad/fecha/escala/origen incorrectos sin generar pendientes", () => {
  const f=fixture();
  try {
    for(const input of [{...manual,value:NaN},{...manual,value:25},{...manual,unit:"bpm"},{...manual,capturedAt:"2026-02-30T08:00:00Z"},{...manual,capturedAt:"2026-01-01"},{...manual,origin:"device"},{...manual,indicator:"wellbeing",unit:"score_1_5",value:2.5},{...manual,capturedAt:new Date(Date.now()+120000).toISOString()}]) {
      assert.throws(()=>f.measurements.manual(f.sessionA,input),errorCode("VALIDATION"));
    }
    assert.equal(f.queue.pending().length,0);
  } finally { f.repo.close(); }
});
test("dispositivo: autenticar, deduplicar, colisión, última comunicación y revocación", () => {
  const f=fixture();
  try {
    provisionDevice(f.repo,f.a.username,"esp32",deviceToken);
    assert.throws(()=>f.measurements.fromDevice("esp32","wrong",pulse),errorCode("DEVICE_UNAUTHORIZED"));
    const one=f.measurements.fromDevice("esp32",deviceToken,pulse);
    const two=f.measurements.fromDevice("esp32",deviceToken,pulse);
    assert.equal(two.duplicate,true); assert.equal(one.measurement.id,two.measurement.id);
    assert.equal(f.queue.pending().length,1);
    assert.ok(f.repo.device("esp32")!.lastCommunicationAt);
    assert.throws(()=>f.measurements.fromDevice("esp32",deviceToken,{...pulse,value:69}),errorCode("READING_CONFLICT"));
    f.repo.run("UPDATE devices SET enabled=0 WHERE id='esp32'");
    assert.throws(()=>f.measurements.fromDevice("esp32",deviceToken,pulse),errorCode("DEVICE_UNAUTHORIZED"));
    assert.equal(f.measurements.history(f.sessionA,new URLSearchParams())[0].deviceId,"esp32");
  } finally { f.repo.close(); }
});
test("fallo de escritura de cola revierte también la medición", () => {
  const f=fixture();
  try {
    f.repo.db.exec("CREATE TRIGGER fail_queue BEFORE INSERT ON sync_queue BEGIN SELECT RAISE(ABORT,'test rollback'); END;");
    assert.throws(()=>f.measurements.manual(f.sessionA,manual));
    assert.equal(f.measurements.history(f.sessionA,new URLSearchParams()).length,0);
    assert.equal(f.queue.pending().length,0);
  } finally { f.repo.close(); }
});
test("historial ordenado, filtrado, paginado y últimos valores independientes por indicador", () => {
  const f=fixture();
  try {
    f.measurements.manual(f.sessionA,manual);
    f.measurements.manual(f.sessionA,{...manual,capturedAt:"2026-01-02T08:00:00Z",value:8});
    f.measurements.manual(f.sessionA,{...manual,indicator:"wellbeing",value:4,unit:"score_1_5"});
    assert.equal(f.measurements.summary(f.sessionA).latest.length,2);
    assert.equal(f.measurements.history(f.sessionA,new URLSearchParams({indicator:"sleep",limit:"1"}))[0].value,8);
    assert.equal(f.measurements.history(f.sessionA,new URLSearchParams({indicator:"sleep",limit:"1",offset:"1"}))[0].value,7.5);
    assert.equal(f.measurements.history(f.sessionA,new URLSearchParams({from:"2026-01-02T00:00:00Z"})).length,1);
    assert.throws(()=>f.measurements.history(f.sessionA,new URLSearchParams({limit:"-1"})),errorCode("VALIDATION"));
  } finally { f.repo.close(); }
});
test("perfil histórico inmutable, lectura tardía, ausencia ambiental y deduplicación tras cambio", () => {
  const f=fixture();
  try {
    const resolve=(_id:string,at:string):EnvironmentContext|null => at<"2025-01-01"?null:{scenarioId:at<"2026-02-01"?"iss_leo":"moon_surface",profileId:"test-profile",profileVersion:at<"2026-02-01"?"1":"2",assignmentId:"assignment-1",scope:"cabin",telemetryAvailable:false};
    const provider:EnvironmentProvider={resolve};
    const service=new MeasurementService(f.repo,f.auth,provider);
    const one=service.manual(f.sessionA,manual).measurement;
    const two=service.manual(f.sessionA,{...manual,capturedAt:"2026-03-01T08:00:00Z"}).measurement;
    assert.equal(one.environment.profileVersion,"1"); assert.equal(two.environment.profileVersion,"2");
    assert.equal(one.environment.telemetryAvailable,false);
    assert.throws(()=>service.manual(f.sessionA,{...manual,capturedAt:"2024-01-01T00:00:00Z"}),errorCode("ENVIRONMENT_MISSING"));
    provisionDevice(f.repo,f.a.username,"esp32",deviceToken);
    const first=service.fromDevice("esp32",deviceToken,pulse);
    provider.resolve=()=>null;
    assert.equal(service.fromDevice("esp32",deviceToken,pulse).measurement.id,first.measurement.id);
    assert.equal(f.queue.pending().find(row=>row.id===one.id)!.payload.environment.profileVersion,"1");
  } finally { f.repo.close(); }
});
test("simulador comparte validación, conserva origen y cola sin confundir valores con referencias", () => {
  const f=fixture();
  try {
    const input={indicator:"heart_rate",value:68,unit:"bpm",capturedAt};
    const result=f.measurements.simulated(f.a.astronautId!,input,"test-run-v1");
    assert.equal(result.measurement.origin,"simulated");
    assert.equal(result.measurement.scenario,"test-run-v1");
    assert.equal(f.queue.pending()[0].payload.value,68);
    assert.throws(()=>f.measurements.simulated(f.a.astronautId!,{...input,value:Infinity},"test-run-v1"),errorCode("VALIDATION"));
  } finally { f.repo.close(); }
});
test("persistencia tras reapertura, intentos fallidos, rechazo visible y confirmación idempotente", () => {
  const dir=mkdtempSync(join(tmpdir(),"nasa-backend-")); const path=join(dir,"test.sqlite");
  const f=fixture(path);
  const measurement=f.measurements.manual(f.sessionA,manual).measurement;
  f.queue.recordAttempt([measurement.id]); f.repo.close();
  const repo=new SqliteRepository(path);
  try {
    const services=createServices(repo);
    const session=services.auth.session(f.loginA.token);
    assert.equal(services.measurements.history(session,new URLSearchParams()).length,1);
    assert.equal(services.queue.pending()[0].attempts,1);
    services.queue.reject(measurement.id,"Perfil desconocido en nube");
    assert.equal(services.measurements.summary(session).queue.rejected,1);
    services.queue.retryRejected(measurement.id);
    assert.equal(services.queue.pending().length,1);
    services.queue.confirm(measurement.id); services.queue.confirm(measurement.id);
    services.queue.reject(measurement.id,"Respuesta vieja");
    assert.equal(services.queue.pending().length,0);
    assert.equal(services.measurements.summary(session).queue.confirmed,1);
  } finally { repo.close(); rmSync(dir,{recursive:true}); }
});
