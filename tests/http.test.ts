<<<<<<< HEAD
import { GET as getEnvironment, PUT as setEnvironment } from "../src/backend/src/app/api/v1/me/environment/route";
import { GET as listAlerts } from "../src/backend/src/app/api/v1/me/alerts/route";
import { POST as actAlert } from "../src/backend/src/app/api/v1/me/alerts/[id]/route";
=======
import { GET as environment, POST as select } from "../src/backend/src/app/api/v1/me/environment/route";
import { POST as signal } from "../src/backend/src/app/api/v1/devices/status/route";
import { sameOrigin } from "../src/backend/src/backend/transport/http";
>>>>>>> a7784becb2c9209f3c47237b12eb7c1f106069a9
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
    const astroCookie=astroLogin.headers.get("set-cookie")!.split(";")[0];
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
<<<<<<< HEAD
    const environmentUrl="/api/v1/me/environment";
    assert.equal((await getEnvironment(request(environmentUrl))).status,401);
    assert.equal((await getEnvironment(request(environmentUrl,"GET",undefined,adminCookie))).status,403);
    const initial=(await (await getEnvironment(request(environmentUrl,"GET",undefined,astroCookie))).json());
    assert.equal(initial.profiles.length,4);
    assert.equal(initial.active.scenarioId,"iss_leo");
    const values=[65,65,65,82,83];
    const start=Date.now()-60_000;
    for (const [index,value] of values.entries()) {
      const reading={...pulse,value,capturedAt:new Date(start+index*1000).toISOString(),readingId:"test-series-"+index};
      assert.equal((await device(request("/api/v1/measurements","POST",reading,undefined,headers))).status,201);
    }
    const alertsUrl="/api/v1/me/alerts";
    assert.equal((await listAlerts(request(alertsUrl,"GET",undefined,adminCookie))).status,403);
    const alerts=(await (await listAlerts(request(alertsUrl,"GET",undefined,astroCookie))).json()).alerts;
    assert.equal(alerts.length,1);
    assert.equal(alerts[0].reason,"deviation");
    const close=await actAlert(request(alertsUrl,"POST",{type:"close"},astroCookie),{params:Promise.resolve({id:alerts[0].id})});
    assert.equal((await close.json()).alert.status,"closed");
    const selected=await setEnvironment(request(environmentUrl,"PUT",{scenarioId:"moon_surface"},astroCookie));
    assert.equal((await selected.json()).active.scenarioId,"moon_surface");
    const late={...pulse,capturedAt:new Date(start+10_000).toISOString(),readingId:"late"};
    const lateResult=await device(request("/api/v1/measurements","POST",late,undefined,headers));
    assert.equal((await lateResult.json()).measurement.environment.scenarioId,"iss_leo");
    const next={...input,capturedAt:new Date().toISOString()};
    const nextResult=await manual(request("/api/v1/me/measurements","POST",next,astroCookie));
    assert.equal((await nextResult.json()).measurement.environment.scenarioId,"moon_surface");
=======
    assert.equal((await signal(request("/api/v1/devices/status","POST",{status:"no_contact",observedAt:new Date().toISOString()},undefined,headers))).status,200);
    assert.equal((await signal(request("/api/v1/devices/status","POST",{status:"no_contact",observedAt:new Date().toISOString()},astroCookie))).status,401);
>>>>>>> a7784becb2c9209f3c47237b12eb7c1f106069a9
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
