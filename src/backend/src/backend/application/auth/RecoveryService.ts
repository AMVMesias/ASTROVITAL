import { randomInt } from "node:crypto";
import { AppError,type Session } from "../../domain/model";
import { object,only,password,text } from "../../domain/validation";
import type { SqliteRepository } from "../../infrastructure/sqlite/SqliteRepository";
import { digest,hashPassword,token,verifyPassword } from "../../infrastructure/security/credentials";
import { AuthService } from "./AuthService";
import { normalizeAnswer,securityQuestions } from "./securityQuestions";

const dummyAnswer=hashPassword("unavailable-recovery-answer");
const invalidAnswer=()=>new AppError(400,"RECOVERY_INVALID","No se pudo verificar la respuesta.");
const locked=()=>new AppError(429,"RECOVERY_LOCKED","Has agotado los 3 intentos. Contacta al administrador.");
const invalidGrant=()=>new AppError(401,"RESET_TOKEN_INVALID","La autorización para cambiar la contraseña es inválida o venció.");

export class RecoveryService {
  constructor(private repo:SqliteRepository,private auth:AuthService,private now=()=>new Date()) {}
  private verified(session:Session) { return this.auth.requireSession(session.sessionId,undefined,true); }
  private newPassword(input:Record<string,unknown>) {
    const value=password({password:input.newPassword});
    if(value!==input.confirmation) throw new AppError(400,"VALIDATION","Las contraseñas no coinciden.",{confirmation:"Confirma la nueva contraseña."});
    return value;
  }
  status(session:Session) {
    const user=this.verified(session);
    const rows=this.repo.all("SELECT question_id FROM security_answers WHERE user_id=? ORDER BY question_id",user.id);
    const failures=Number(this.repo.get("SELECT failures FROM recovery_attempts WHERE subject=?",`user:${user.id}`)?.failures??0);
    return {requiresOnboarding:user.requiresOnboarding,securityQuestionsConfigured:rows.length===3,
      questions:rows.map(row=>securityQuestions.find(question=>question.id===row.question_id)),recoveryLocked:failures>=3};
  }
  completeOnboarding(session:Session,value:unknown) {
    const input=object(value);only(input,["newPassword","confirmation","answers"]);
    const next=this.newPassword(input);
    if(!Array.isArray(input.answers)||input.answers.length!==3) throw new AppError(400,"VALIDATION","Configura exactamente tres preguntas distintas.");
    const answers=input.answers.map(entry=>{
      const answer=object(entry);only(answer,["questionId","answer"]);
      const questionId=text(answer,"questionId",1,64);
      if(!securityQuestions.some(question=>question.id===questionId)) throw new AppError(400,"VALIDATION","Pregunta no admitida.");
      const normalized=normalizeAnswer(text(answer,"answer",1,200));
      if(!normalized||normalized.length>200) throw new AppError(400,"VALIDATION","Respuesta inválida.");
      return {questionId,normalized};
    });
    if(new Set(answers.map(answer=>answer.questionId)).size!==3) throw new AppError(400,"VALIDATION","Elige tres preguntas diferentes.");
    return this.repo.atomic(()=>{
      const current=this.verified(session),account=this.repo.account(current.id)!;
      if(!account.requiresOnboarding&&this.repo.get("SELECT user_id FROM security_answers WHERE user_id=? LIMIT 1",account.id)) throw new AppError(409,"ALREADY_CONFIGURED","El primer acceso ya fue completado.");
      if(verifyPassword(next,account.passwordHash)) throw new AppError(400,"PASSWORD_UNCHANGED","Usa una contraseña distinta de la inicial.");
      this.repo.resetRecovery(account.id,true);
      for(const answer of answers) this.repo.run("INSERT INTO security_answers VALUES(?,?,?)",account.id,answer.questionId,hashPassword(answer.normalized));
      this.repo.saveAccount({...account,passwordHash:hashPassword(next),requiresOnboarding:false});
      this.repo.revokeUserSessions(account.id);
      this.repo.clearFailures(account.username);
      this.repo.audit(account.id,account.id,"onboarding_completed");
      return {status:"completed",requiresLogin:true};
    });
  }
  start(value:unknown) {
    const input=object(value);only(input,["username"]);
    const username=text(input,"username",1,64).toLowerCase();
    return this.repo.atomic(()=>{
      const user=this.repo.accountByUsername(username);
      const subject=user?`user:${user.id}`:`unknown:${digest(username)}`;
      this.repo.run("INSERT INTO recovery_attempts(subject) VALUES(?) ON CONFLICT DO NOTHING",subject);
      const failures=Number(this.repo.get("SELECT failures FROM recovery_attempts WHERE subject=?",subject)!.failures);
      if(failures>=3) throw locked();
      const now=this.now().toISOString();
      let challenge=this.repo.get("SELECT * FROM recovery_challenges WHERE subject=?",subject);
      if(!challenge||String(challenge.expires_at)<=now||challenge.consumed===1) {
        const saved=user?.enabled&&!user.requiresOnboarding?this.repo.all("SELECT question_id FROM security_answers WHERE user_id=? ORDER BY question_id",user.id):[];
        const configured=saved.length===3;
        const pool=configured?saved.map(row=>String(row.question_id)):securityQuestions.map(question=>question.id);
        const questionId=pool[randomInt(pool.length)];
        this.repo.run("DELETE FROM recovery_challenges WHERE subject=?",subject);
        this.repo.run("INSERT INTO recovery_challenges VALUES(?,?,?,?,?,0)",token(),subject,configured?user!.id:null,questionId,new Date(this.now().getTime()+10*60_000).toISOString());
        challenge=this.repo.get("SELECT * FROM recovery_challenges WHERE subject=?",subject)!;
      }
      return {challengeId:String(challenge.id),question:securityQuestions.find(question=>question.id===challenge.question_id)!,expiresAt:String(challenge.expires_at),attemptsRemaining:Math.max(0,3-failures)};
    });
  }
  verify(value:unknown) {
    const input=object(value);only(input,["challengeId","answer"]);
    const challengeId=text(input,"challengeId",64,64),answer=normalizeAnswer(text(input,"answer",1,200));
    // Los fallos se devuelven desde la transacción y se lanzan después: el contador debe hacer commit.
    const result=this.repo.atomic(()=>{
      const challenge=this.repo.get("SELECT * FROM recovery_challenges WHERE id=?",challengeId);
      if(!challenge) return invalidAnswer();
      const failures=Number(this.repo.get("SELECT failures FROM recovery_attempts WHERE subject=?",challenge.subject)!.failures);
      if(failures>=3) return locked();
      if(String(challenge.expires_at)<=this.now().toISOString()) return new AppError(410,"CHALLENGE_EXPIRED","El desafío venció. Solicita otro; los intentos se conservan.");
      if(challenge.consumed===1) return invalidAnswer();
      const user=challenge.user_id?this.repo.account(String(challenge.user_id)):null;
      const stored=user?this.repo.get("SELECT answer_hash FROM security_answers WHERE user_id=? AND question_id=?",user.id,challenge.question_id):undefined;
      const correct=verifyPassword(answer,stored?String(stored.answer_hash):dummyAnswer);
      if(!correct||!user?.enabled||user.requiresOnboarding||!stored) {
        this.repo.run("UPDATE recovery_attempts SET failures=failures+1 WHERE subject=?",challenge.subject);
        return failures+1>=3?locked():invalidAnswer();
      }
      const raw=token(),expiresAt=new Date(this.now().getTime()+5*60_000).toISOString();
      this.repo.run("DELETE FROM password_reset_grants WHERE user_id=?",user.id);
      this.repo.run("INSERT INTO password_reset_grants VALUES(?,?,?)",digest(raw),user.id,expiresAt);
      this.repo.run("UPDATE recovery_challenges SET consumed=1 WHERE id=?",challengeId);
      return {resetToken:raw,expiresAt};
    });
    if(result instanceof AppError) throw result;
    return result;
  }
  resetPassword(value:unknown) {
    const input=object(value);only(input,["resetToken","newPassword","confirmation"]);
    const raw=text(input,"resetToken",64,64),next=this.newPassword(input);
    return this.repo.atomic(()=>{
      const grant=this.repo.get("SELECT * FROM password_reset_grants WHERE token_hash=?",digest(raw));
      const user=grant?this.repo.account(String(grant.user_id)):null;
      const failures=user?Number(this.repo.get("SELECT failures FROM recovery_attempts WHERE subject=?",`user:${user.id}`)?.failures??0):3;
      if(!grant||String(grant.expires_at)<=this.now().toISOString()||!user?.enabled||user.requiresOnboarding||failures>=3) throw invalidGrant();
      if(verifyPassword(next,user.passwordHash)) throw new AppError(400,"PASSWORD_UNCHANGED","Usa una contraseña distinta de la anterior.");
      this.repo.saveAccount({...user,passwordHash:hashPassword(next)});
      this.repo.revokeUserSessions(user.id);
      this.repo.resetRecovery(user.id,false);
      this.repo.clearFailures(user.username);
      this.repo.audit(user.id,user.id,"password_recovered");
      return {status:"password_changed",requiresLogin:true};
    });
  }
  unlock(session:Session,userId:string) {
    return this.repo.atomic(()=>{
      const author=this.auth.requireSession(session.sessionId,"admin");
      if(!this.repo.account(userId)) throw new AppError(404,"NOT_FOUND","Cuenta no encontrada.");
      this.repo.resetRecovery(userId,false);
      this.repo.audit(author.id,userId,"recovery_unlocked");
      return {status:"unlocked"};
    });
  }
}
