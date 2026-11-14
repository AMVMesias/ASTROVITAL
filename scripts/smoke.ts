import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteRepository } from "../src/backend/src/backend/infrastructure/sqlite/SqliteRepository";
import { provisionDevice,seed } from "../src/backend/src/backend/infrastructure/sqlite/seed";

async function main() {
  const directory=mkdtempSync(join(tmpdir(),"nasa-production-"));
  const path=join(directory,"smoke.sqlite"), password=randomBytes(24).toString("hex");
  const repo=new SqliteRepository(path); seed(repo,"admin",password); repo.close();
  const listener=createServer();
  await new Promise<void>(resolve=>listener.listen(0,"127.0.0.1",resolve));
  const address=listener.address();
  if(!address || typeof address==="string") throw new Error("Puerto no disponible.");
  const port=address.port;
  await new Promise<void>(resolve=>listener.close(()=>resolve()));
  const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","src/backend","--hostname","127.0.0.1","--port",String(port)],{env:{...process.env,SQLITE_PATH:path,APP_ORIGIN:`http://127.0.0.1:${port}`,APP_MODE:"local",VERCEL:"",COOKIE_SECURE:"false"},stdio:["ignore","pipe","pipe"]});
  let log=""; child.stdout.on("data",chunk=>{log+=String(chunk);}); child.stderr.on("data",chunk=>{log+=String(chunk);});
  const root=`http://127.0.0.1:${port}`;
  try {
    let ready=false;
    for(let i=0;i<80;i++) {
      try { ready=(await fetch(`${root}/api/health`)).ok; } catch { /* arranque en progreso */ }
      if(ready) break;
      if(child.exitCode!==null) throw new Error(`Next.js terminó durante arranque: ${log}`);
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.ok(ready,`No inició Next.js: ${log}`);
    assert.equal((await fetch(`${root}/api/openapi`)).status,200);
    assert.ok((await (await fetch(`${root}/api/docs`)).text()).includes("SwaggerUIBundle"));
    for(const file of ["swagger-ui.css","swagger-ui-bundle.js"]) {
      const asset=await fetch(`${root}/api/docs/assets/${file}`);
      assert.equal(asset.status,200,`Asset ${file}: ${log}`);
    }
    const login=await fetch(`${root}/api/v1/auth/login`,{method:"POST",headers:{"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({username:"admin",password})});
    assert.equal(login.status,200);
    const cookie=login.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await fetch(`${root}/api/v1/users`,{headers:{cookie}})).status,200);
    assert.equal((await fetch(`${root}/api/v1/me/measurements`,{headers:{cookie}})).status,403);
    assert.equal((await fetch(`${root}/api/v1/users`)).status,401);
    const creation=await fetch(`${root}/api/v1/users`,{method:"POST",headers:{cookie,"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({username:"recovery-smoke",name:"Recovery Smoke",role:"astronauta",password})});
    assert.equal(creation.status,201);
    const onboardLogin=await fetch(`${root}/api/v1/auth/login`,{method:"POST",headers:{"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({username:"recovery-smoke",password})});
    const restrictedCookie=onboardLogin.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await onboardLogin.json()).user.requiresOnboarding,true);
    const answers=[{questionId:"first-pet",answer:"gato"},{questionId:"childhood-city",answer:"Quito"},{questionId:"first-school",answer:"escuela"}];
    const configuredPassword=password+"-configured";
    const onboarding=await fetch(`${root}/api/v1/auth/onboarding`,{method:"POST",headers:{cookie:restrictedCookie,"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({newPassword:configuredPassword,confirmation:configuredPassword,answers})});
    assert.equal(onboarding.status,200);
    const challengeResponse=await fetch(`${root}/api/v1/auth/recovery/start`,{method:"POST",headers:{"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({username:"recovery-smoke"})});
    assert.equal(challengeResponse.status,200);
    const challenge=await challengeResponse.json();
    const verification=await fetch(`${root}/api/v1/auth/recovery/verify`,{method:"POST",headers:{"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({challengeId:challenge.challengeId,answer:answers.find(answer=>answer.questionId===challenge.question.id)!.answer})});
    assert.equal(verification.status,200);
    const grant=await verification.json(),recoveredPassword=password+"-recovered";
    const resetBody=JSON.stringify({resetToken:grant.resetToken,newPassword:recoveredPassword,confirmation:recoveredPassword});
    const resetOptions={method:"POST",headers:{"content-type":"application/json","x-nasa-request":"1"},body:resetBody};
    assert.equal((await fetch(`${root}/api/v1/auth/recovery/reset`,resetOptions)).status,200);
    assert.equal((await fetch(`${root}/api/v1/auth/recovery/reset`,resetOptions)).status,401);
    const recoveredLogin=await fetch(`${root}/api/v1/auth/login`,{method:"POST",headers:{"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({username:"recovery-smoke",password:recoveredPassword})});
    assert.equal(recoveredLogin.status,200);
    assert.equal((await recoveredLogin.json()).user.requiresOnboarding,false);
    console.log("Primer acceso y recuperación verificados por HTTP en producción; autorización de un solo uso.");
    if(process.env.BRIDGE_TEST_PYTHON) {
      const create=await fetch(`${root}/api/v1/users`,{method:"POST",headers:{cookie,"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({username:"bridge-astro",name:"Bridge Test",role:"astronauta",password})});
      assert.equal(create.status,201);
      const deviceToken=randomBytes(32).toString("hex");
      const local=new SqliteRepository(path);provisionDevice(local,"bridge-astro","esp32-test",deviceToken);local.close();
      const auth=await fetch(`${root}/api/v1/auth/login`,{method:"POST",headers:{"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({username:"bridge-astro",password})});
      const initialCookie=auth.headers.get("set-cookie")!.split(";")[0];
      const setup=await fetch(`${root}/api/v1/auth/onboarding`,{method:"POST",headers:{cookie:initialCookie,"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({newPassword:password+"-changed",confirmation:password+"-changed",answers:[{questionId:"first-pet",answer:"gato"},{questionId:"childhood-city",answer:"Quito"},{questionId:"first-school",answer:"escuela"}]})});
      assert.equal(setup.status,200);
      const configured=await fetch(`${root}/api/v1/auth/login`,{method:"POST",headers:{"content-type":"application/json","x-nasa-request":"1"},body:JSON.stringify({username:"bridge-astro",password:password+"-changed"})});
      const astroCookie=configured.headers.get("set-cookie")!.split(";")[0];
      const python=process.env.BRIDGE_TEST_PYTHON;
      const emitter=spawn(python,["-u","-c",`import os,pty,time
master,slave=pty.openpty()
print(os.ttyname(slave),flush=True)
start=time.monotonic()
while True:
 state='100' if time.monotonic()-start<4 else '0'
 bpm='68' if state=='100' else '0'
 os.write(master,('1.2,'+bpm+','+state+',5,12,100,120,98,68,150'+chr(10)).encode())
 time.sleep(.004)
`],{stdio:["ignore","pipe","pipe"]});
      let bridge:ReturnType<typeof spawn>|undefined;
      try {
        const port=await new Promise<string>((resolve,reject)=>{emitter.stdout.once("data",value=>resolve(String(value).trim()));emitter.once("error",reject);});
        bridge=spawn(python,["tools/bridge/bridge.py","serial"],{env:{...process.env,DEVICE_ID:"esp32-test",DEVICE_TOKEN:deviceToken,BRIDGE_API_URL:root,SERIAL_PORT:port,BRIDGE_SPOOL_PATH:join(directory,"bridge.sqlite")},stdio:"ignore"});
        let observed=false;
        for(let i=0;i<60;i++) {
          const response=await fetch(`${root}/api/v1/me/measurements/latest`,{headers:{cookie:astroCookie}});
          const summary=await response.json();
          if(summary.latest.some((value:{value:number})=>value.value===68)&&summary.devices[0]?.signal?.status==="no_contact") {observed=true;break;}
          await new Promise(resolve=>setTimeout(resolve,250));
        }
        assert.ok(observed,"El puente debe persistir pulso y después pérdida de contacto desde el puerto serial emulado.");
        console.log("Puente serial → HTTP → SQLite verificado con pseudoterminal, sin hardware físico.");
      } finally {
        for(const process of [bridge,emitter]) if(process && process.exitCode===null && process.signalCode===null) {
          process.kill("SIGTERM");await new Promise(resolve=>process.once("exit",resolve));
        }
      }
    }
    console.log("Producción HTTP verificada: salud, Swagger/OpenAPI, assets locales, login, permisos y sesión.");
  } finally {
    child.kill("SIGTERM");
    if(child.exitCode===null) await new Promise(resolve=>child.once("exit",resolve));
    rmSync(directory,{recursive:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
