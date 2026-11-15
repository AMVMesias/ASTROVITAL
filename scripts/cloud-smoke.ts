import assert from "node:assert/strict";
const endpoint=process.env.API_URL ?? "https://astrovital-health.vercel.app";
async function main(){
  assert.equal((await fetch(`${endpoint}/api/health`)).status,200);
  assert.equal((await fetch(`${endpoint}/api/v1/auth/session`)).status,401);
  const username=process.env.SMOKE_USERNAME,password=process.env.SMOKE_PASSWORD;
  if(!username||!password)throw new Error("Define SMOKE_USERNAME y SMOKE_PASSWORD para comprobar el login.");
  const headers={"Content-Type":"application/json","X-Nasa-Request":"1"};
  const login=await fetch(`${endpoint}/api/v1/auth/login`,{method:"POST",headers,body:JSON.stringify({username,password})});
  assert.equal(login.status,200);const cookie=login.headers.get("set-cookie")?.split(";")[0];assert.ok(cookie);
  assert.equal((await fetch(`${endpoint}/api/v1/auth/session`,{headers:{cookie}})).status,200);
  assert.equal((await fetch(`${endpoint}/api/v1/auth/logout`,{method:"POST",headers:{...headers,cookie}})).status,200);
  assert.equal((await fetch(`${endpoint}/api/v1/auth/session`,{headers:{cookie}})).status,401);
  console.log("HTTPS, login real, cookie de sesión y logout verificados.");
}
main().catch(()=>{console.error("Falló la comprobación HTTP. Revisa el despliegue y las credenciales de prueba.");process.exitCode=1;});
