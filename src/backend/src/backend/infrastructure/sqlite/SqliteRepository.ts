import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { migrate } from "./migrations";
import type { Repository } from "../../domain/repository";
import { AppError, type Account, type Device, type Measurement, type MeasurementQuery, type QueueRecord, type Role, type User } from "../../domain/model";

type Row = Record<string, string | number | bigint | Uint8Array | null>;
const selectAccount = `SELECT u.*, a.id AS astronaut_id, a.mission_id, a.module_id FROM users u LEFT JOIN astronauts a ON a.user_id=u.id`;
function account(row: Row | undefined): Account | null {
  if (!row) return null;
  return { id: String(row.id), username: String(row.username), name: String(row.name), role: row.role as Role,
    enabled: row.enabled === 1, createdAt: String(row.created_at), passwordHash: String(row.password_hash),
    astronautId: row.astronaut_id === null ? null : String(row.astronaut_id),
    missionId: row.mission_id === null ? null : String(row.mission_id), moduleId: row.module_id === null ? null : String(row.module_id) };
}
function administrative(value: Account): User {
  const { passwordHash: _secret, ...user } = value;
  void _secret;
  return user;
}

export class SqliteRepository implements Repository {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
    migrate(this.db);
  }
  close() { this.db.close(); }
  get(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).get(...args); }
  all(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).all(...args); }
  run(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).run(...args); }
  atomic<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = work(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  account(id: string) { return account(this.get(`${selectAccount} WHERE u.id=?`, id)); }
  accountByUsername(username: string) { return account(this.get(`${selectAccount} WHERE u.username=?`, username)); }
  users() { return this.all(`${selectAccount} ORDER BY u.created_at,u.id`).map(row => administrative(account(row)!)); }
  saveAccount(user: Account) {
    this.run(`INSERT INTO users VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,
      name=excluded.name,password_hash=excluded.password_hash,role=excluded.role,enabled=excluded.enabled`,
    user.id, user.username, user.name, user.passwordHash, user.role, Number(user.enabled), user.createdAt);
    if (user.astronautId) this.run("INSERT INTO astronauts VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING", user.astronautId, user.id, user.missionId, user.moduleId);
  }
  audit(author: string, target: string, action: string) { this.run("INSERT INTO audit VALUES(?,?,?,?,?)", randomUUID(), author, target, action, new Date().toISOString()); }
  session(id: string) {
    const row = this.get("SELECT user_id,expires_at FROM sessions WHERE id=?", id);
    return row ? { userId: String(row.user_id), expiresAt: String(row.expires_at) } : null;
  }
  saveSession(id: string, user: string, expires: string) { this.run("INSERT INTO sessions VALUES(?,?,?)", id, user, expires); }
  revokeSession(id: string) { this.run("DELETE FROM sessions WHERE id=?", id); }
  revokeUserSessions(id: string) { this.run("DELETE FROM sessions WHERE user_id=?", id); }
  blockedUntil(username: string) { const row = this.get("SELECT blocked_until FROM login_attempts WHERE username=? AND failures>=5", username); return row ? String(row.blocked_until) : null; }
  loginFailure(username: string) {
    this.run(`INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(username) DO UPDATE SET
      failures=CASE WHEN blocked_until < ? THEN 1 ELSE failures+1 END,
      blocked_until=CASE WHEN failures>=4 AND blocked_until>=? THEN ? ELSE excluded.blocked_until END`,
    username, new Date(Date.now() + 60_000).toISOString(), new Date().toISOString(), new Date().toISOString(), new Date(Date.now() + 900_000).toISOString());
  }
  clearFailures(username: string) { this.run("DELETE FROM login_attempts WHERE username=?", username); }
  device(id: string) {
    const row = this.get("SELECT * FROM devices WHERE id=?", id);
    return row ? { id: String(row.id), astronautId: String(row.astronaut_id), credentialHash: String(row.credential_hash), enabled: row.enabled === 1, lastCommunicationAt: row.last_communication_at ? String(row.last_communication_at) : null } : null;
  }
  devices(id: string): Device[] {
    return this.all("SELECT * FROM devices WHERE astronaut_id=? ORDER BY id", id).map(row => ({ id: String(row.id), astronautId: id, enabled: row.enabled === 1, lastCommunicationAt: row.last_communication_at ? String(row.last_communication_at) : null }));
  }
  touchDevice(id: string, at: string) { this.run("UPDATE devices SET last_communication_at=? WHERE id=?", at, id); }
  deviceReading(device: string, reading: string) {
    const row = this.get("SELECT payload,fingerprint FROM measurements WHERE device_id=? AND reading_id=?", device, reading);
    return row ? { measurement: JSON.parse(String(row.payload)) as Measurement, fingerprint: String(row.fingerprint) } : null;
  }
  saveMeasurement(value: Measurement, fingerprint: string) {
    const payload = JSON.stringify(value);
    this.run("INSERT INTO measurements VALUES(?,?,?,?,?,?,?,?)", value.id, value.astronautId, value.indicator, value.capturedAt, value.deviceId, value.readingId, fingerprint, payload);
    this.run("INSERT INTO sync_queue(id,payload) VALUES(?,?)", value.id, payload);
  }
  measurements(id: string, query: MeasurementQuery) {
    return this.all(`SELECT payload FROM measurements WHERE astronaut_id=? AND (? IS NULL OR indicator=?)
      AND (? IS NULL OR captured_at>=?) AND (? IS NULL OR captured_at<=?) ORDER BY captured_at DESC,id DESC LIMIT ? OFFSET ?`,
    id, query.indicator ?? null, query.indicator ?? null, query.from ?? null, query.from ?? null, query.to ?? null, query.to ?? null, query.limit, query.offset).map(row => JSON.parse(String(row.payload)) as Measurement);
  }
  latest(id: string) {
    return this.all(`SELECT payload FROM (SELECT payload,ROW_NUMBER() OVER(PARTITION BY indicator ORDER BY captured_at DESC,id DESC) AS pos FROM measurements WHERE astronaut_id=?) WHERE pos=1`, id).map(row => JSON.parse(String(row.payload)) as Measurement);
  }
  pending(limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new AppError(400, "VALIDATION", "Lote entre 1 y 500.");
    return this.all("SELECT * FROM sync_queue WHERE status='pending' ORDER BY rowid LIMIT ?", limit).map(row => ({ id: String(row.id), payload: JSON.parse(String(row.payload)) as Measurement, status: row.status as QueueRecord["status"], attempts: Number(row.attempts), reason: row.reason ? String(row.reason) : null, confirmedAt: row.confirmed_at ? String(row.confirmed_at) : null }));
  }
  queueStatus(astronautId: string) {
    const counts = { pending: 0, confirmed: 0, rejected: 0 };
    for (const row of this.all("SELECT q.status,COUNT(*) AS n FROM sync_queue q JOIN measurements m ON m.id=q.id WHERE m.astronaut_id=? GROUP BY q.status", astronautId)) counts[row.status as keyof typeof counts] = Number(row.n);
    const rejections = this.all("SELECT q.id,q.reason FROM sync_queue q JOIN measurements m ON m.id=q.id WHERE m.astronaut_id=? AND q.status='rejected' ORDER BY q.rowid DESC LIMIT 100", astronautId).map(row => ({ id: String(row.id), reason: row.reason ? String(row.reason) : null }));
    return { ...counts, rejections };
  }
  attempt(ids: string[]) { this.atomic(() => { for (const id of ids) this.run("UPDATE sync_queue SET attempts=attempts+1 WHERE id=? AND status='pending'", id); }); }
  acknowledge(id: string, outcome: "confirmed" | "rejected", reason?: string) {
    if (outcome === "rejected" && !reason?.trim()) throw new AppError(400, "VALIDATION", "El rechazo necesita motivo.");
    if (!this.get("SELECT id FROM sync_queue WHERE id=?", id)) throw new AppError(404, "NOT_FOUND", "Pendiente inexistente.");
    this.run("UPDATE sync_queue SET status=?,reason=?,confirmed_at=? WHERE id=? AND status!='confirmed'", outcome, outcome === "rejected" ? reason! : null, outcome === "confirmed" ? new Date().toISOString() : null, id);
  }
  retry(id: string) { this.run("UPDATE sync_queue SET status='pending',reason=NULL WHERE id=? AND status='rejected'", id); }
}
