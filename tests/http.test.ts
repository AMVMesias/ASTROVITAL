import { POST as telemetryCapture } from "../src/backend/src/app/api/v1/devices/telemetry/route";
import { GET as telemetryHistory } from "../src/backend/src/app/api/v1/me/telemetry/route";
import { GET as telemetryLatest } from "../src/backend/src/app/api/v1/me/telemetry/latest/route";
import { GET as listAlerts } from "../src/backend/src/app/api/v1/me/alerts/route";
import { GET as alertDetail, POST as actAlert } from "../src/backend/src/app/api/v1/me/alerts/[id]/route";
import { onboardingBody } from "./fixtures/auth";
import { POST as completeOnboarding } from "../src/backend/src/app/api/v1/auth/onboarding/route";
import { GET as environment, POST as select, PUT as setEnvironment } from "../src/backend/src/app/api/v1/me/environment/route";
import { POST as signal } from "../src/backend/src/app/api/v1/devices/status/route";
import { sameOrigin } from "../src/backend/src/backend/transport/http";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import SwaggerParser from "@apidevtools/swagger-parser";
import { openapi } from "../src/backend/src/backend/transport/openapi";
import { localServices } from "../src/backend/src/backend/composition/local";
import { seed, provisionDevice } from "../src/backend/src/backend/infrastructure/sqlite/seed";
import { GET as docs } from "../src/backend/src/app/api/docs/route";
import { GET as assets } from "../src/backend/src/app/api/docs/assets/[file]/route";
import { GET as schema } from "../src/backend/src/app/api/openapi/route";
import { POST as login } from "../src/backend/src/app/api/v1/auth/login/route";
import { POST as logout } from "../src/backend/src/app/api/v1/auth/logout/route";
import { GET as session } from "../src/backend/src/app/api/v1/auth/session/route";
import { GET as users, POST as createUser } from "../src/backend/src/app/api/v1/users/route";
import { PATCH as editUser } from "../src/backend/src/app/api/v1/users/[id]/route";
import { GET as history, POST as manual } from "../src/backend/src/app/api/v1/me/measurements/route";
import { GET as latest } from "../src/backend/src/app/api/v1/me/measurements/latest/route";
import { POST as device } from "../src/backend/src/app/api/v1/measurements/route";

function request(path: string, method="GET", body?: unknown, cookie?: string, extra?: Record<string,string>) {
  return new NextRequest(`http://localhost:3000${path}`, { method, headers: { "content-type":"application/json", "x-nasa-request":"1", ...(cookie?{cookie}:{}), ...extra }, body: body===undefined?undefined:JSON.stringify(body) });
}

test("OpenAPI válido, Swagger local sin CDN, rutas documentadas y assets limitados", async () => {
  const parsed=await SwaggerParser.validate(JSON.parse(JSON.stringify(openapi)));
  assert.equal(parsed.info.version,"1.0.0");
  assert.deepEqual(parsed.paths?.["/api/v1/sync/measurements"]?.post?.security,[{syncBearer:[]}]);
  assert.equal((await schema().json()).openapi,"3.0.3");
  const html=await docs().text();
  assert.ok(html.includes("/api/docs/assets/swagger-ui-bundle.js"));
  assert.ok(!html.includes("https://"));
  for(const file of ["swagger-ui.css","swagger-ui-bundle.js"]) {
    const response=await assets(new Request("http://localhost"),{params:Promise.resolve({file})});
    assert.equal(response.status,200); assert.ok((await response.text()).length>1000);
  }
  assert.equal((await assets(new Request("http://localhost"),{params:Promise.resolve({file:"package.json"})})).status,404);
});

test("HTTP completo: cookies, CSRF, roles, captura, dispositivo, revocación y errores", async () => {
  const dir=mkdtempSync(join(tmpdir(),"nasa-http-"));
  process.env.SQLITE_PATH=join(dir,"http.sqlite");
  const app=localServices();
  const password="http-password-long-123";
  try {
    seed(app.repo,"admin",password);
    const badOrigin=await login(request("/api/v1/auth/login","POST",{username:"admin",password},undefined,{origin:"https://attacker.invalid"}));
    assert.equal(badOrigin.status,403);
    assert.equal((await session(request("/api/v1/auth/session"))).status,401);
    const adminLogin=await login(request("/api/v1/auth/login","POST",{username:"admin",password}));
    assert.equal(adminLogin.status,200);
    const setCookie=adminLogin.headers.get("set-cookie")!;
    assert.ok(setCookie.includes("HttpOnly")); assert.ok(setCookie.includes("SameSite=strict"));
    assert.equal((await adminLogin.json()).token,undefined);
    const adminCookie=setCookie.split(";")[0];
    const create=await createUser(request("/api/v1/users","POST",{username:"astro-http",name:"HTTP Astronaut",role:"astronauta",password},adminCookie));
    assert.equal(create.status,201);
    const user=(await create.json()).user;
    assert.equal(user.passwordHash,undefined);
    const astroLogin=await login(request("/api/v1/auth/login","POST",{username:user.username,password}));
    const initialCookie=astroLogin.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await astroLogin.json()).user.requiresOnboarding,true);
    assert.equal((await history(request("/api/v1/me/measurements","GET",undefined,initialCookie))).status,403);
    assert.equal((await listAlerts(request("/api/v1/me/alerts","GET",undefined,initialCookie))).status,403);
    assert.equal((await setEnvironment(request("/api/v1/me/environment","PUT",{scenarioId:"mars_surface"},initialCookie))).status,403);
    assert.equal((await completeOnboarding(request("/api/v1/auth/onboarding","POST",onboardingBody(password+"-changed"),initialCookie))).status,200);
    const configuredLogin=await login(request("/api/v1/auth/login","POST",{username:user.username,password:password+"-changed"}));
    const astroCookie=configuredLogin.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await users(request("/api/v1/users","GET",undefined,astroCookie))).status,403);
    assert.equal((await history(request("/api/v1/me/measurements","GET",undefined,adminCookie))).status,403);
    const catalog=await environment(request("/api/v1/me/environment","GET",undefined,astroCookie));
    assert.equal(catalog.status,200);
    const environmentBody=await catalog.json();assert.equal(environmentBody.profiles.length,4);
    assert.equal((await environment(request("/api/v1/me/environment","GET",undefined,adminCookie))).status,403);
    const selected=await select(request("/api/v1/me/environment","POST",{scenarioId:"moon_surface",revision:environmentBody.revision},astroCookie));
    assert.equal(selected.status,200);
    const input={indicator:"sleep",value:7,unit:"h",capturedAt:new Date().toISOString()};
    const created=await manual(request("/api/v1/me/measurements","POST",input,astroCookie));
    assert.equal(created.status,201);
    const payload=await created.json();
    assert.equal(payload.measurement.astronautId,user.astronautId);
    assert.equal(payload.measurement.environment.scenarioId,"moon_surface");
    assert.equal(payload.evaluation.status,"done");
    assert.equal(created.headers.get("cache-control"),"no-store");
    assert.equal((await (await latest(request("/api/v1/me/measurements/latest","GET",undefined,astroCookie))).json()).queue.pending,1);
    assert.equal((await history(request("/api/v1/me/measurements?astronautId=other","GET",undefined,astroCookie))).status,400);
    const deviceToken="http-device-token-long-00000000000001";
    provisionDevice(app.repo,user.username,"esp32-http",deviceToken);
    const pulse={indicator:"heart_rate",value:68,unit:"bpm",capturedAt:new Date().toISOString(),readingId:"boot-1"};
    const headers={"x-device-id":"esp32-http",authorization:`Bearer ${deviceToken}`};
    assert.equal((await device(request("/api/v1/measurements","POST",pulse,undefined,headers))).status,201);
    assert.equal((await device(request("/api/v1/measurements","POST",pulse,undefined,headers))).status,200);
    assert.equal((await device(request("/api/v1/measurements","POST",{...pulse,value:69},undefined,headers))).status,409);
    assert.equal((await device(request("/api/v1/measurements","POST",pulse,astroCookie))).status,401);
    assert.equal((await signal(request("/api/v1/devices/status","POST",{status:"no_contact",observedAt:new Date().toISOString()},undefined,headers))).status,200);
    assert.equal((await signal(request("/api/v1/devices/status","POST",{status:"no_contact",observedAt:new Date().toISOString()},astroCookie))).status,401);
    // Las rutas remotas comparten contexto histórico, evaluación recuperable y autorización.
    const environmentUrl="/api/v1/me/environment";
    assert.equal(environmentBody.active.scenarioId,"iss_leo");
    assert.ok(environmentBody.assignment.reference.revision);
    assert.equal((await setEnvironment(request(environmentUrl,"PUT",{scenarioId:"unknown"},astroCookie))).status,400);
    assert.equal((await setEnvironment(request(environmentUrl,"PUT",{scenarioId:"mars_surface"},adminCookie))).status,403);
    const switched=await setEnvironment(request(environmentUrl,"PUT",{scenarioId:"mars_surface"},astroCookie));
    assert.equal(switched.status,200);
    const switchedBody=await switched.json();
    assert.equal(switchedBody.active.scenarioId,"mars_surface");
    const repeated=await setEnvironment(request(environmentUrl,"PUT",{scenarioId:"mars_surface"},astroCookie));
    assert.equal((await repeated.json()).active.assignmentId,switchedBody.active.assignmentId);
    assert.equal(app.repo.measurements(user.astronautId,{limit:100,offset:0}).find(value=>value.id===payload.measurement.id)!.environment.scenarioId,"moon_surface");
    assert.equal((await listAlerts(request("/api/v1/me/alerts"))).status,401);
    assert.equal((await listAlerts(request("/api/v1/me/alerts","GET",undefined,adminCookie))).status,403);
    // Preparar ocho lecturas cronológicas válidas, posteriores a la asignación de Marte.
    const start=Date.now();
    await new Promise(resolve=>setTimeout(resolve,100));
    for(const [index,value] of [65,65,65,65,65,90,91,92].entries()) {
      const result=await device(request("/api/v1/measurements","POST",{...pulse,value,capturedAt:new Date(start+index*10).toISOString(),readingId:"remote-series-"+index},undefined,headers));
      assert.equal(result.status,201);
      assert.equal((await result.json()).evaluation.status,"done");
    }
    const summary=await (await latest(request("/api/v1/me/measurements/latest","GET",undefined,astroCookie))).json();
    const evaluation=summary.evaluation.find((item:{indicator:string})=>item.indicator==="heart_rate");
    assert.equal(evaluation.status,"deviation");
    assert.equal(evaluation.direction,"above");
    assert.match(evaluation.recommendation.id,/^pulse-/);
    assert.equal(evaluation.assessment.status,evaluation.status);
    const alertsUrl="/api/v1/me/alerts";
    const alerts=(await (await listAlerts(request(alertsUrl,"GET",undefined,astroCookie))).json()).alerts;
    assert.equal(alerts.length,1);
    assert.deepEqual(alerts[0].evidence.recommendation,evaluation.recommendation);
    const context={params:Promise.resolve({id:alerts[0].id})};
    assert.equal((await alertDetail(request(alertsUrl,"GET",undefined,adminCookie),context)).status,403);
    const other=app.users.save(app.auth.session(adminCookie.slice("nasa_session=".length)),{username:"other-http",name:"Other",role:"astronauta",password});
    // Una cuenta distinta, incluso con sesión válida restringida, no puede consultar avisos.
    const otherLogin=await login(request("/api/v1/auth/login","POST",{username:other.username,password}));
    const otherInitial=otherLogin.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await completeOnboarding(request("/api/v1/auth/onboarding","POST",onboardingBody(password+"-other"),otherInitial))).status,200);
    const otherConfigured=await login(request("/api/v1/auth/login","POST",{username:other.username,password:password+"-other"}));
    const otherCookie=otherConfigured.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await alertDetail(request(alertsUrl,"GET",undefined,otherCookie),context)).status,404);
    assert.equal((await actAlert(request(alertsUrl,"POST",{type:"close"},otherCookie),context)).status,404);
    const close=await actAlert(request(alertsUrl,"POST",{type:"close",note:"Verificado"},astroCookie),context);
    assert.equal((await close.json()).alert.status,"closed");
    assert.equal((await actAlert(request(alertsUrl,"POST",{type:"track"},astroCookie),context)).status,409);
    const telemetryUrl="/api/v1/devices/telemetry";
    const telemetryInput={readingId:"telemetry-http-1",capturedAt:new Date().toISOString(),fields:{ecg:0,bpm_ecg:0,estado_ecg_x50:0,resp_mg:-1,rpm:0,estado_resp_x50:50,spo2:0,bpm_oxi:0,estado_oxi_x50:50,ir:1490,rojo:2316}};
    assert.equal((await telemetryCapture(request(telemetryUrl,"POST",telemetryInput))).status,401);
    const telemetryResponse=await telemetryCapture(request(telemetryUrl,"POST",telemetryInput,undefined,headers));
    assert.equal(telemetryResponse.status,200);
    assert.equal((await telemetryResponse.json()).readingId,telemetryInput.readingId);
    assert.equal((await (await telemetryCapture(request(telemetryUrl,"POST",telemetryInput,undefined,headers))).json()).duplicate,true);
    assert.equal((await telemetryHistory(request("/api/v1/me/telemetry","GET",undefined,adminCookie))).status,403);
    assert.equal((await telemetryHistory(request("/api/v1/me/telemetry"))).status,401);
    const raw=await (await telemetryLatest(request("/api/v1/me/telemetry/latest","GET",undefined,astroCookie))).json();
    assert.equal(raw.samples[0].fields.ir,1490);
    assert.equal(raw.samples[0].sensors.ecg.bpm,null);
    assert.equal((await (await telemetryHistory(request("/api/v1/me/telemetry","GET",undefined,otherCookie))).json()).samples.length,0);
    const combined=await (await latest(request("/api/v1/me/measurements/latest","GET",undefined,astroCookie))).json();
    assert.equal(combined.telemetry.readingId,telemetryInput.readingId);
    const invalidJson=new NextRequest("http://localhost:3000/api/v1/me/measurements",{method:"POST",headers:{"content-type":"application/json","x-nasa-request":"1",cookie:astroCookie},body:"{"});
    assert.equal((await manual(invalidJson)).status,400);
    assert.equal((await manual(request("/api/v1/me/measurements","POST",{note:"x".repeat(17000)},astroCookie))).status,413);
    const edited=await editUser(request(`/api/v1/users/${user.id}`,"PATCH",{enabled:false},adminCookie),{params:Promise.resolve({id:user.id})});
    assert.equal(edited.status,200);
    assert.equal((await session(request("/api/v1/auth/session","GET",undefined,astroCookie))).status,401);
    assert.equal((await login(request("/api/v1/auth/login","POST",{username:user.username,password}))).status,401);
    assert.equal((await logout(request("/api/v1/auth/logout","POST",undefined,adminCookie))).status,200);
    assert.equal((await users(request("/api/v1/users","GET",undefined,adminCookie))).status,401);
  } finally { app.repo.close(); rmSync(dir,{recursive:true}); delete process.env.SQLITE_PATH; }
});

test("Swagger directo y frontend configurado son orígenes permitidos; terceros se rechazan",()=>{
 const original=process.env.APP_ORIGIN;
 process.env.APP_ORIGIN="http://localhost:3000";
 try {
  for(const origin of ["http://localhost:3001","http://localhost:3000"]) assert.doesNotThrow(()=>sameOrigin(new Request("http://localhost:3001/api/v1/auth/login",{headers:{Origin:origin}})));
  assert.throws(()=>sameOrigin(new Request("http://localhost:3001/api/v1/auth/login",{headers:{Origin:"https://attacker.invalid"}})));
 } finally {if(original===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=original;}
});
