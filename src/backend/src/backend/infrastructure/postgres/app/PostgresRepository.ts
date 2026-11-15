import { Database, type SQLInputValue } from "../database";
import { randomUUID } from "node:crypto";
import type { Repository } from "../../../domain/repository";
import { AppError, type Account, type Device, type Measurement, type MeasurementQuery, type Role, type User } from "../../../domain/model";

type Row = Record<string, string | number | bigint | Uint8Array | null>;
const selectAccount = `SELECT u.*, a.id AS astronaut_id, a.mission_id, a.module_id FROM users u LEFT JOIN astronauts a ON a.user_id=u.id`;
function account(row: Row | undefined): Account | null {
  if (!row) return null;
  return { id: String(row.id), username: String(row.username), name: String(row.name), role: row.role as Role,
    enabled: row.enabled === 1, requiresOnboarding: row.requires_onboarding === 1, createdAt: String(row.created_at), passwordHash: String(row.password_hash),
    astronautId: row.astronaut_id === null ? null : String(row.astronaut_id),
    missionId: row.mission_id === null ? null : String(row.mission_id), moduleId: row.module_id === null ? null : String(row.module_id) };
}
function administrative(value: Account): User {
  const { passwordHash: _secret, ...user } = value;
  void _secret;
  return user;
}

export class PostgresRepository implements Repository {
  constructor(readonly db: Database) {}
  async get(sql: string, ...args: SQLInputValue[]) { return (await this.db.prepare(sql).get(...args)); }
  async all(sql: string, ...args: SQLInputValue[]) { return (await this.db.prepare(sql).all(...args)); }
  async run(sql: string, ...args: SQLInputValue[]) { return (await this.db.prepare(sql).run(...args)); }
  async atomic<T>(work: () => T | Promise<T>): Promise<T> { return this.db.atomic(work); }
  async account(id: string) { return account((await this.get(`${selectAccount} WHERE u.id=?`, id))); }
  async accountByUsername(username: string) { return account((await this.get(`${selectAccount} WHERE u.username=?`, username))); }
  async users() { return (await this.all(`${selectAccount} ORDER BY u.created_at,u.id`)).map(row => administrative(account(row)!)); }
  async saveAccount(user: Account) {
    (await this.run(`INSERT INTO users(id,username,name,password_hash,role,enabled,created_at,requires_onboarding) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,
      name=excluded.name,password_hash=excluded.password_hash,role=excluded.role,enabled=excluded.enabled,requires_onboarding=excluded.requires_onboarding`,
    user.id, user.username, user.name, user.passwordHash, user.role, Number(user.enabled), user.createdAt, Number(user.requiresOnboarding)));
    if (user.astronautId) {
      (await this.run("INSERT INTO astronauts VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING", user.astronautId, user.id, user.missionId, user.moduleId));
      (await this.run(`INSERT INTO astronaut_environment_assignments(mission_id,astronaut_id,effective_from,revision,scenario_id)
        SELECT ?,?,?,value,'iss_leo' FROM app_settings WHERE key='environment_revision'
        AND NOT EXISTS(SELECT 1 FROM astronaut_environment_assignments WHERE mission_id=? AND astronaut_id=?)`,
        user.missionId,user.astronautId,user.createdAt,user.missionId,user.astronautId));
    }
  }
  async audit(author: string, target: string, action: string) { (await this.run("INSERT INTO audit VALUES(?,?,?,?,?)", randomUUID(), author, target, action, new Date().toISOString())); }
  async session(id: string) {
    const row = (await this.get("SELECT user_id,expires_at FROM sessions WHERE id=?", id));
    return row ? { userId: String(row.user_id), expiresAt: String(row.expires_at) } : null;
  }
  async saveSession(id: string, user: string, expires: string) { (await this.run("INSERT INTO sessions VALUES(?,?,?)", id, user, expires)); }
  async sessionAccount(id: string) {
    const row=await this.get(`${selectAccount.replace("u.*,","u.*, s.expires_at,")} JOIN sessions s ON s.user_id=u.id WHERE s.id=?`,id);
    return row ? {user:account(row)!,expiresAt:String(row.expires_at)} : null;
  }
  async claimSession(user: Account,id:string,expiresAt:string,currentId?:string) {
    return this.db.atomic(async()=>{
      // Lock only this account; concurrent logins cannot both claim it.
      const fresh=await this.get("SELECT id FROM users WHERE id=? AND password_hash=? AND enabled=1 FOR UPDATE",user.id,user.passwordHash);
      if(!fresh) throw new AppError(401,"INVALID_CREDENTIALS","La cuenta cambió. Inicia sesión de nuevo.");
      await this.run("DELETE FROM sessions WHERE user_id=? AND expires_at<=?",user.id,new Date().toISOString());
      const active=await this.get("SELECT id,expires_at FROM sessions WHERE user_id=? ORDER BY expires_at,id LIMIT 1",user.id);
      if(active){
        if(active.id!==currentId) throw new AppError(409,"SESSION_ACTIVE","Esta cuenta ya tiene una sesión activa. Cierra esa sesión o espera a que venza.");
        return {id:String(active.id),expiresAt:String(active.expires_at)};
      }
      await this.saveSession(id,user.id,expiresAt);
      await this.clearFailures(user.username);
      return {id,expiresAt};
    },false);
  }
  async revokeSession(id: string) { (await this.run("DELETE FROM sessions WHERE id=?", id)); }
  async revokeUserSessions(id: string) { (await this.run("DELETE FROM sessions WHERE user_id=?", id)); }
  async blockedUntil(username: string) { const row = (await this.get("SELECT blocked_until FROM login_attempts WHERE username=? AND failures>=5", username)); return row ? String(row.blocked_until) : null; }
  async loginFailure(username: string) {
    (await this.run(`INSERT INTO login_attempts AS attempts VALUES(?,1,?) ON CONFLICT(username) DO UPDATE SET
      failures=CASE WHEN attempts.blocked_until < ? THEN 1 ELSE attempts.failures+1 END,
      blocked_until=CASE WHEN attempts.failures>=4 AND attempts.blocked_until>=? THEN ? ELSE excluded.blocked_until END`,
    username, new Date(Date.now() + 60_000).toISOString(), new Date().toISOString(), new Date().toISOString(), new Date(Date.now() + 900_000).toISOString()));
  }
  async clearFailures(username: string) { (await this.run("DELETE FROM login_attempts WHERE username=?", username)); }
  async resetRecovery(userId: string, clearAnswers: boolean) {
    (await this.run("DELETE FROM recovery_challenges WHERE subject=?",`user:${userId}`));
    (await this.run("DELETE FROM password_reset_grants WHERE user_id=?",userId));
    (await this.run("DELETE FROM recovery_attempts WHERE subject=?",`user:${userId}`));
    if(clearAnswers) (await this.run("DELETE FROM security_answers WHERE user_id=?",userId));
  }
  async device(id: string) {
    const row = (await this.get("SELECT * FROM devices WHERE id=?", id));
    return row ? { id: String(row.id), astronautId: String(row.astronaut_id), credentialHash: String(row.credential_hash), enabled: row.enabled === 1, lastCommunicationAt: row.last_communication_at ? String(row.last_communication_at) : null } : null;
  }
  async devices(id: string): Promise<Device[]> {
    return (await this.all("SELECT d.*,s.status,s.observed_at FROM devices d LEFT JOIN device_status s ON s.device_id=d.id WHERE astronaut_id=? ORDER BY d.id", id)).map(row => ({ id: String(row.id), astronautId: id, signal: row.status ? {status:String(row.status),observedAt:String(row.observed_at)} : null, enabled: row.enabled === 1, lastCommunicationAt: row.last_communication_at ? String(row.last_communication_at) : null }));
  }
  async touchDevice(id: string, at: string) { (await this.run("UPDATE devices SET last_communication_at=? WHERE id=?", at, id)); }
  async signalStatus(id: string, status: string, observedAt: string, receivedAt: string) {
    (await this.run(`INSERT INTO device_status VALUES(?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET
      status=excluded.status,observed_at=excluded.observed_at,received_at=excluded.received_at
      WHERE excluded.observed_at>device_status.observed_at`,id,status,observedAt,receivedAt));
  }
  async deviceReading(device: string, reading: string) {
    const row = (await this.get("SELECT payload,fingerprint FROM measurements WHERE device_id=? AND reading_id=?", device, reading));
    return row ? { measurement: JSON.parse(String(row.payload)) as Measurement, fingerprint: String(row.fingerprint) } : null;
  }
  async saveMeasurement(value: Measurement, fingerprint: string) {
    const payload = JSON.stringify(value);
    (await this.run("INSERT INTO measurements VALUES(?,?,?,?,?,?,?,?)", value.id, value.astronautId, value.indicator, value.capturedAt, value.deviceId, value.readingId, fingerprint, payload));
    (await this.run("INSERT INTO assessment_jobs(id) VALUES(?)",value.id));
  }
  async measurements(id: string, query: MeasurementQuery) {
    return (await this.all(`SELECT payload FROM measurements WHERE astronaut_id=? AND (CAST(? AS TEXT) IS NULL OR indicator=?)
      AND (CAST(? AS TEXT) IS NULL OR captured_at>=?) AND (CAST(? AS TEXT) IS NULL OR captured_at<=?) ORDER BY captured_at DESC,id DESC LIMIT ? OFFSET ?`,
    id, query.indicator ?? null, query.indicator ?? null, query.from ?? null, query.from ?? null, query.to ?? null, query.to ?? null, query.limit, query.offset)).map(row => JSON.parse(String(row.payload)) as Measurement);
  }
  async latest(id: string) {
    return (await this.all(`SELECT payload FROM (SELECT payload,ROW_NUMBER() OVER(PARTITION BY indicator ORDER BY captured_at DESC,id DESC) AS pos FROM measurements WHERE astronaut_id=?) WHERE pos=1`, id)).map(row => JSON.parse(String(row.payload)) as Measurement);
  }

}
