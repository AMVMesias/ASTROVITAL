import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { SqliteRepository } from "../src/backend/src/backend/infrastructure/sqlite/SqliteRepository";
import { seed } from "../src/backend/src/backend/infrastructure/sqlite/seed";
import { createServices,localServices } from "../src/backend/src/backend/composition/local";
import { AppError } from "../src/backend/src/backend/domain/model";
import { RecoveryService } from "../src/backend/src/backend/application/auth/RecoveryService";
import { securityQuestions } from "../src/backend/src/backend/application/auth/securityQuestions";
import { SECURITY_QUESTIONS } from "../src/frontend/src/frontend/features/auth/securityQuestions";
import { onboardingBody } from "./fixtures/auth";
import { POST as login } from "../src/backend/src/app/api/v1/auth/login/route";
import { GET as catalogue } from "../src/backend/src/app/api/v1/auth/security-questions/route";
import { POST as complete, GET as state } from "../src/backend/src/app/api/v1/auth/onboarding/route";
import { POST as start } from "../src/backend/src/app/api/v1/auth/recovery/start/route";
import { POST as verify } from "../src/backend/src/app/api/v1/auth/recovery/verify/route";
import { POST as reset } from "../src/backend/src/app/api/v1/auth/recovery/reset/route";
import { POST as unlock } from "../src/backend/src/app/api/v1/users/[id]/recovery/unlock/route";

const initial="Initial-test-password-123",configured="Configured-test-password-123",recovered="Recovered-test-password-123";
const code=(expected:string)=>(error:unknown)=>error instanceof AppError&&error.code===expected;
function fixture(path=":memory:") {
  const repo=new SqliteRepository(path);seed(repo,"admin",initial);
  const app=createServices(repo);
  const admin=app.auth.session(app.auth.login({username:"admin",password:initial}).token);
  const user=app.users.save(admin,{username:"astro-recovery",name:"Astronauta",role:"astronauta",password:initial});
  const pending=app.auth.login({username:user.username,password:initial});
  return {...app,admin,user,pending,session:app.auth.session(pending.token)};
}
function finish(f:ReturnType<typeof fixture>) {
  f.recovery.completeOnboarding(f.session,onboardingBody(configured));
  const login=f.auth.login({username:f.user.username,password:configured});
  return {login,session:f.auth.session(login.token)};
}
function answerFor(id:string) {return onboardingBody(configured).answers.find(answer=>answer.questionId===id)!.answer;}

test("catálogo de servidor coincide con la interfaz sin importar respuestas del navegador",()=>{
  assert.deepEqual(securityQuestions,SECURITY_QUESTIONS);
});
test("primer acceso restringido, contraseña diferente, tres preguntas y hashes; sesión nueva obligatoria",()=>{
  const f=fixture();try {
    assert.equal(f.pending.user.requiresOnboarding,true);
    assert.equal(f.recovery.status(f.session).securityQuestionsConfigured,false);
    assert.throws(()=>f.measurements.history(f.session,new URLSearchParams()),code("ONBOARDING_REQUIRED"));
    assert.throws(()=>f.recovery.completeOnboarding(f.session,onboardingBody(initial)),code("PASSWORD_UNCHANGED"));
    for(let i=0;i<5;i++) assert.throws(()=>f.auth.login({username:f.user.username,password:"wrong"}));
    const next=finish(f);
    assert.equal(next.session.requiresOnboarding,false);
    assert.throws(()=>f.auth.session(f.pending.token),code("UNAUTHENTICATED"));
    assert.throws(()=>f.auth.login({username:f.user.username,password:initial}),code("INVALID_CREDENTIALS"));
    const rows=f.repo.all("SELECT * FROM security_answers WHERE user_id=?",f.user.id);
    assert.equal(rows.length,3);
    for(const row of rows) {assert.ok(String(row.answer_hash).startsWith("scrypt$"));assert.notEqual(row.answer_hash,answerFor(String(row.question_id)));}
    assert.equal(f.recovery.status(next.session).securityQuestionsConfigured,true);
    assert.throws(()=>f.recovery.completeOnboarding(next.session,onboardingBody(recovered)),code("ALREADY_CONFIGURED"));
    assert.equal(JSON.stringify(f.recovery.status(next.session)).includes("answer_hash"),false);
  } finally {f.repo.close();}
});
test("configuración valida preguntas/confirmación y revierte una escritura incompleta",()=>{
  const f=fixture();try {
    const data=onboardingBody(configured);
    for(const invalid of [{...data,confirmation:"different"},{...data,answers:data.answers.slice(0,2)}, {...data,answers:[data.answers[0],data.answers[0],data.answers[2]]}, {...data,answers:[...data.answers.slice(0,2),{questionId:"unknown",answer:"x"}]}]) assert.throws(()=>f.recovery.completeOnboarding(f.session,invalid),code("VALIDATION"));
    f.repo.db.exec("CREATE TRIGGER fail_answer BEFORE INSERT ON security_answers WHEN NEW.question_id='first-school' BEGIN SELECT RAISE(ABORT,'test'); END;");
    assert.throws(()=>f.recovery.completeOnboarding(f.session,data));
    assert.equal(f.repo.all("SELECT * FROM security_answers").length,0);
    assert.equal(f.repo.account(f.user.id)?.requiresOnboarding,true);
    assert.doesNotThrow(()=>f.auth.session(f.pending.token));
  } finally {f.repo.close();}
});
test("pregunta fija, respuesta normalizada, token con hash y uso único; contraseña y sesiones reales cambian",()=>{
  const f=fixture();try {
    const normal=finish(f);
    const challenge=f.recovery.start({username:f.user.username});
    assert.deepEqual(f.recovery.start({username:f.user.username.toUpperCase()}),challenge);
    const result=f.recovery.verify({challengeId:challenge.challengeId,answer:"  "+answerFor(challenge.question.id).toUpperCase()+"  "});
    assert.equal(f.repo.get("SELECT token_hash FROM password_reset_grants WHERE token_hash=?",result.resetToken),undefined);
    assert.throws(()=>f.recovery.verify({challengeId:challenge.challengeId,answer:answerFor(challenge.question.id)}),code("RECOVERY_INVALID"));
    assert.throws(()=>f.recovery.resetPassword({resetToken:"0".repeat(64),newPassword:recovered,confirmation:recovered}),code("RESET_TOKEN_INVALID"));
    assert.throws(()=>f.recovery.resetPassword({resetToken:result.resetToken,newPassword:recovered,confirmation:"wrong"}),code("VALIDATION"));
    assert.equal(f.recovery.resetPassword({resetToken:result.resetToken,newPassword:recovered,confirmation:recovered}).requiresLogin,true);
    assert.throws(()=>f.auth.session(normal.login.token),code("UNAUTHENTICATED"));
    assert.throws(()=>f.auth.login({username:f.user.username,password:configured}),code("INVALID_CREDENTIALS"));
    assert.doesNotThrow(()=>f.auth.login({username:f.user.username,password:recovered}));
    assert.throws(()=>f.recovery.resetPassword({resetToken:result.resetToken,newPassword:initial,confirmation:initial}),code("RESET_TOKEN_INVALID"));
    assert.equal(f.repo.all("SELECT * FROM password_reset_grants").length,0);
  } finally {f.repo.close();}
});
test("desafíos nuevos y vencidos no reinician intentos; tres fallos solo bloquean recuperación",()=>{
  const f=fixture();try {
    finish(f);
    let clock=Date.now();const recovery=new RecoveryService(f.repo,f.auth,()=>new Date(clock));
    const first=recovery.start({username:f.user.username});
    for(let i=0;i<2;i++) assert.throws(()=>recovery.verify({challengeId:first.challengeId,answer:"wrong"}),code("RECOVERY_INVALID"));
    clock+=11*60_000;
    assert.throws(()=>recovery.verify({challengeId:first.challengeId,answer:"wrong"}),code("CHALLENGE_EXPIRED"));
    const second=recovery.start({username:f.user.username});
    assert.notEqual(second.challengeId,first.challengeId);assert.equal(second.attemptsRemaining,1);
    assert.throws(()=>recovery.verify({challengeId:second.challengeId,answer:"wrong"}),code("RECOVERY_LOCKED"));
    assert.throws(()=>recovery.start({username:f.user.username}),code("RECOVERY_LOCKED"));
    assert.doesNotThrow(()=>f.auth.login({username:f.user.username,password:configured}));
  } finally {f.repo.close();}
});
test("bloqueo persiste tras reinicio y el admin lo desbloquea conservando respuestas",()=>{
  const directory=mkdtempSync(join(tmpdir(),"nasa-recovery-")),path=join(directory,"auth.sqlite");
  const f=fixture(path);const normal=finish(f);
  const challenge=f.recovery.start({username:f.user.username});
  for(let i=0;i<3;i++) assert.throws(()=>f.recovery.verify({challengeId:challenge.challengeId,answer:"wrong"}));
  f.repo.close();const repo=new SqliteRepository(path),app=createServices(repo);
  try {
    assert.throws(()=>app.recovery.start({username:f.user.username}),code("RECOVERY_LOCKED"));
    assert.throws(()=>app.recovery.unlock(app.auth.session(normal.login.token),f.user.id),code("FORBIDDEN"));
    const admin=app.auth.session(app.auth.login({username:"admin",password:initial}).token);
    app.recovery.unlock(admin,f.user.id);
    assert.equal(app.recovery.start({username:f.user.username}).attemptsRemaining,3);
    assert.equal(repo.all("SELECT * FROM security_answers WHERE user_id=?",f.user.id).length,3);
    assert.equal(repo.get("SELECT action FROM audit WHERE action='recovery_unlocked'")?.action,"recovery_unlocked");
  } finally {repo.close();rmSync(directory,{recursive:true});}
});
test("autorización temporal expira y cambios de credencial del admin invalidan todo el flujo",()=>{
  const f=fixture();try {
    finish(f);let clock=Date.now();const recovery=new RecoveryService(f.repo,f.auth,()=>new Date(clock));
    const challenge=recovery.start({username:f.user.username});
    const grant=recovery.verify({challengeId:challenge.challengeId,answer:answerFor(challenge.question.id)});
    clock+=6*60_000;
    assert.throws(()=>recovery.resetPassword({resetToken:grant.resetToken,newPassword:recovered,confirmation:recovered}),code("RESET_TOKEN_INVALID"));
    f.users.save(f.admin,{password:recovered},f.user.id);
    assert.equal(f.repo.account(f.user.id)?.requiresOnboarding,true);
    assert.equal(f.repo.all("SELECT * FROM security_answers").length,0);
    assert.equal(f.repo.all("SELECT * FROM password_reset_grants").length,0);
    assert.throws(()=>f.recovery.resetPassword({resetToken:grant.resetToken,newPassword:initial,confirmation:initial}),code("RESET_TOKEN_INVALID"));
  } finally {f.repo.close();}
});
test("cuentas inexistentes y no configuradas no pueden autorizar cambios con respuestas de ejemplo",()=>{
  const f=fixture();try {
    for(const username of ["nonexistent",f.user.username]) {
      const challenge=f.recovery.start({username});
      assert.ok(challenge.question.id);assert.equal(challenge.attemptsRemaining,3);
      assert.throws(()=>f.recovery.verify({challengeId:challenge.challengeId,answer:"demo"}),code("RECOVERY_INVALID"));
    }
    assert.equal(f.repo.all("SELECT * FROM password_reset_grants").length,0);
    assert.equal(f.repo.users().length,2);
  } finally {f.repo.close();}
});

function request(path:string,value?:unknown,cookie?:string,origin?:string) {
  return new NextRequest("http://localhost:3001"+path,{method:value===undefined?"GET":"POST",headers:{"content-type":"application/json","x-nasa-request":"1",...(cookie?{cookie}:{}),...(origin?{origin}:{})},body:value===undefined?undefined:JSON.stringify(value)});
}
test("endpoints de primer acceso y recuperación: cookie restringida, CSRF, estados y contraseña real",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"nasa-recovery-http-"));process.env.SQLITE_PATH=join(directory,"auth.sqlite");
  const app=localServices();seed(app.repo,"admin",initial);
  try {
    assert.equal((await catalogue().json()).questions.length,6);
    assert.equal((await state(request("/api/v1/auth/onboarding"))).status,401);
    const admin=app.auth.session(app.auth.login({username:"admin",password:initial}).token);
    const user=app.users.save(admin,{username:"astro-http",name:"Astronauta",role:"astronauta",password:initial});
    const pending=await login(request("/api/v1/auth/login",{username:user.username,password:initial}));
    const cookie=pending.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await pending.json()).user.requiresOnboarding,true);
    assert.equal((await state(request("/api/v1/auth/onboarding",undefined,cookie))).status,200);
    const completed=await complete(request("/api/v1/auth/onboarding",onboardingBody(configured),cookie));
    assert.equal(completed.status,200);assert.ok(completed.headers.get("set-cookie")!.includes("Max-Age=0"));
    assert.equal((await state(request("/api/v1/auth/onboarding",undefined,cookie))).status,401);
    assert.equal((await start(request("/api/v1/auth/recovery/start",{username:user.username},undefined,"https://attacker.invalid"))).status,403);
    const response=await start(request("/api/v1/auth/recovery/start",{username:user.username}));
    assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
    const challenge=await response.json();
    const verified=await verify(request("/api/v1/auth/recovery/verify",{challengeId:challenge.challengeId,answer:answerFor(challenge.question.id)}));
    assert.equal(verified.status,200);const grant=await verified.json();
    const changed=await reset(request("/api/v1/auth/recovery/reset",{resetToken:grant.resetToken,newPassword:recovered,confirmation:recovered}));
    assert.equal(changed.status,200);
    assert.equal((await login(request("/api/v1/auth/login",{username:user.username,password:recovered}))).status,200);
    assert.equal((await reset(request("/api/v1/auth/recovery/reset",{resetToken:grant.resetToken,newPassword:initial,confirmation:initial}))).status,401);
    const adminLogin=await login(request("/api/v1/auth/login",{username:"admin",password:initial}));
    const adminCookie=adminLogin.headers.get("set-cookie")!.split(";")[0];
    const result=await unlock(request(`/api/v1/users/${user.id}/recovery/unlock`,{},adminCookie),{params:Promise.resolve({id:user.id})});
    assert.equal(result.status,200);
  } finally {app.repo.close();delete process.env.SQLITE_PATH;rmSync(directory,{recursive:true});}
});
