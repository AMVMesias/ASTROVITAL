import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteRepository } from "../src/backend/src/backend/infrastructure/sqlite/SqliteRepository";
import { seed } from "../src/backend/src/backend/infrastructure/sqlite/seed";

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
    console.log("Producción HTTP verificada: salud, Swagger/OpenAPI, assets locales, login, permisos y sesión.");
  } finally {
    child.kill("SIGTERM");
    if(child.exitCode===null) await new Promise(resolve=>child.once("exit",resolve));
    rmSync(directory,{recursive:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
