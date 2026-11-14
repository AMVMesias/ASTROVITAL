import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import SwaggerParser from "@apidevtools/swagger-parser";
import { openapi } from "../backend/src/backend/transport/openapi";
import { localServices } from "../backend/src/backend/composition/local";
import { seed, provisionDevice } from "../backend/src/backend/infrastructure/sqlite/seed";
import { GET as docs } from "../backend/src/app/api/docs/route";
import { GET as assets } from "../backend/src/app/api/docs/assets/[file]/route";
import { GET as schema } from "../backend/src/app/api/openapi/route";
import { POST as login } from "../backend/src/app/api/v1/auth/login/route";
import { POST as logout } from "../backend/src/app/api/v1/auth/logout/route";
import { GET as session } from "../backend/src/app/api/v1/auth/session/route";
import { GET as users, POST as createUser } from "../backend/src/app/api/v1/users/route";
import { PATCH as editUser } from "../backend/src/app/api/v1/users/[id]/route";
import { GET as history, POST as manual } from "../backend/src/app/api/v1/me/measurements/route";
import { GET as latest } from "../backend/src/app/api/v1/me/measurements/latest/route";
import { POST as device } from "../backend/src/app/api/v1/measurements/route";

function request(path: string, method="GET", body?: unknown, cookie?: string, extra?: Record<string,string>) {
  return new NextRequest(`http://localhost:3000${path}`, { method, headers: { "content-type":"application/json", "x-nasa-request":"1", ...(cookie?{cookie}:{}), ...extra }, body: body===undefined?undefined:JSON.stringify(body) });
}

test("OpenAPI válido, Swagger local sin CDN, rutas documentadas y assets limitados", async () => {
  const parsed=await SwaggerParser.validate(JSON.parse(JSON.stringify(openapi)));
  assert.equal(parsed.info.version,"1.0.0");
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
    const input={indicator:"sleep",value:7,unit:"h",capturedAt:"2026-01-01T08:00:00Z"};
    const created=await manual(request("/api/v1/me/measurements","POST",input,astroCookie));
    assert.equal(created.status,201);
    const payload=await created.json();
    assert.equal(payload.measurement.astronautId,user.astronautId);
    assert.equal(created.headers.get("cache-control"),"no-store");
    assert.equal((await (await latest(request("/api/v1/me/measurements/latest","GET",undefined,astroCookie))).json()).queue.pending,1);
    assert.equal((await history(request("/api/v1/me/measurements?astronautId=other","GET",undefined,astroCookie))).status,400);
    const deviceToken="http-device-token-long-00000000000001";
    provisionDevice(app.repo,user.username,"esp32-http",deviceToken);
    const pulse={indicator:"heart_rate",value:68,unit:"bpm",capturedAt:"2026-01-01T08:00:00Z",readingId:"boot-1"};
    const headers={"x-device-id":"esp32-http",authorization:`Bearer ${deviceToken}`};
    assert.equal((await device(request("/api/v1/measurements","POST",pulse,undefined,headers))).status,201);
    assert.equal((await device(request("/api/v1/measurements","POST",pulse,undefined,headers))).status,200);
    assert.equal((await device(request("/api/v1/measurements","POST",{...pulse,value:69},undefined,headers))).status,409);
    assert.equal((await device(request("/api/v1/measurements","POST",pulse,astroCookie))).status,401);
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
