import type { DatabaseSync } from "node:sqlite";

// Persona 2 añade migraciones con otro ID; las ya aplicadas son inmutables.
export const migrations = [{ id: "001_person1_local", sql: `
CREATE TABLE missions(id TEXT PRIMARY KEY, name TEXT NOT NULL, phase TEXT NOT NULL);
CREATE TABLE modules(id TEXT PRIMARY KEY, mission_id TEXT NOT NULL REFERENCES missions(id), name TEXT NOT NULL);
CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','astronauta')),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), created_at TEXT NOT NULL);
CREATE TABLE astronauts(id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
 mission_id TEXT NOT NULL REFERENCES missions(id), module_id TEXT NOT NULL REFERENCES modules(id));
CREATE TABLE sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE audit(id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id), target_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE devices(id TEXT PRIMARY KEY, astronaut_id TEXT NOT NULL REFERENCES astronauts(id), credential_hash TEXT NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), last_communication_at TEXT);
CREATE TABLE indicators(id TEXT PRIMARY KEY, config_version TEXT NOT NULL, config_json TEXT NOT NULL);
CREATE TABLE measurements(id TEXT PRIMARY KEY, astronaut_id TEXT NOT NULL REFERENCES astronauts(id),
 indicator TEXT NOT NULL REFERENCES indicators(id), captured_at TEXT NOT NULL, device_id TEXT REFERENCES devices(id), reading_id TEXT,
 fingerprint TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(device_id, reading_id));
CREATE INDEX measurement_history ON measurements(astronaut_id,indicator,captured_at,id);
CREATE TABLE sync_queue(id TEXT PRIMARY KEY REFERENCES measurements(id), payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected')), attempts INTEGER NOT NULL DEFAULT 0,
 reason TEXT, confirmed_at TEXT);
CREATE TABLE login_attempts(username TEXT PRIMARY KEY, failures INTEGER NOT NULL, blocked_until TEXT NOT NULL);
` }];

export function migrate(db: DatabaseSync) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const migration of migrations) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (!db.prepare("SELECT id FROM schema_migrations WHERE id=?").get(migration.id)) {
        db.exec(migration.sql);
        db.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(migration.id, new Date().toISOString());
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
}
