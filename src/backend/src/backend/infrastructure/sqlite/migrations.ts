import type { DatabaseSync } from "node:sqlite";
import { migrateEnvironment } from "./environmentRepository";
import { migrateAlerts } from "./alertRepository";

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

const modules = [
  { id: "002_environment_shared", apply: migrateEnvironment },
  { id: "003_alerts_shared", apply: migrateAlerts },
  { id: "004_person1_integration", apply(db: DatabaseSync) { db.exec(`
    CREATE TABLE local_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE assessment_jobs(id TEXT PRIMARY KEY REFERENCES measurements(id), attempts INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done')), error TEXT, rule_version TEXT, result TEXT);
    INSERT INTO assessment_jobs(id) SELECT id FROM measurements;
    CREATE TABLE device_status(device_id TEXT PRIMARY KEY REFERENCES devices(id), status TEXT NOT NULL,
      observed_at TEXT NOT NULL, received_at TEXT NOT NULL);
  `); } },
  { id: "005_auth_recovery", apply(db: DatabaseSync) { db.exec(`
    ALTER TABLE users ADD COLUMN requires_onboarding INTEGER NOT NULL DEFAULT 0 CHECK(requires_onboarding IN (0,1));
    CREATE TABLE security_answers(user_id TEXT NOT NULL REFERENCES users(id), question_id TEXT NOT NULL,
      answer_hash TEXT NOT NULL, PRIMARY KEY(user_id,question_id));
    CREATE TABLE recovery_attempts(subject TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0 CHECK(failures>=0));
    CREATE TABLE recovery_challenges(id TEXT PRIMARY KEY, subject TEXT NOT NULL UNIQUE, user_id TEXT REFERENCES users(id),
      question_id TEXT NOT NULL, expires_at TEXT NOT NULL, consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0,1)));
    CREATE TABLE password_reset_grants(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      expires_at TEXT NOT NULL);
  `); } },
  { id: "006_sensor_telemetry", apply(db: DatabaseSync) { db.exec(`
    CREATE TABLE sensor_telemetry(device_id TEXT NOT NULL REFERENCES devices(id), reading_id TEXT NOT NULL,
      astronaut_id TEXT NOT NULL REFERENCES astronauts(id), captured_at TEXT NOT NULL, received_at TEXT NOT NULL,
      payload TEXT NOT NULL, PRIMARY KEY(device_id,reading_id));
    CREATE INDEX telemetry_history ON sensor_telemetry(astronaut_id,captured_at,device_id,reading_id);
  `); } },
];

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
  for (const component of modules) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (!db.prepare("SELECT id FROM schema_migrations WHERE id=?").get(component.id)) {
        component.apply(db);
        db.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(component.id, new Date().toISOString());
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }

}
