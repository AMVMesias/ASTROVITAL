CREATE SCHEMA IF NOT EXISTS app;
SET search_path TO app, public;

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

CREATE TABLE login_attempts(username TEXT PRIMARY KEY, failures INTEGER NOT NULL, blocked_until TEXT NOT NULL);


    CREATE TABLE IF NOT EXISTS environment_catalog_revisions (
      revision TEXT PRIMARY KEY NOT NULL,
      schema_version TEXT NOT NULL,
      sources TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS environment_profiles (
      revision TEXT NOT NULL REFERENCES environment_catalog_revisions (revision),
      scenario_id TEXT NOT NULL,
      definition TEXT NOT NULL,
      PRIMARY KEY (revision, scenario_id)
    );

    CREATE TABLE IF NOT EXISTS astronaut_environment_assignments (
      mission_id TEXT NOT NULL,
      astronaut_id TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      revision TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      PRIMARY KEY (mission_id, astronaut_id, effective_from),
      FOREIGN KEY (revision, scenario_id) REFERENCES environment_profiles (revision, scenario_id)
    );
  

    CREATE TABLE IF NOT EXISTS astronaut_alerts (
      id TEXT PRIMARY KEY NOT NULL,
      mission_id TEXT NOT NULL,
      astronaut_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('open', 'tracking', 'closed')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS astronaut_alert_owner
      ON astronaut_alerts (mission_id, astronaut_id, created_at);
    CREATE TABLE IF NOT EXISTS astronaut_alert_actions (
      sequence BIGSERIAL PRIMARY KEY,
      alert_id TEXT NOT NULL REFERENCES astronaut_alerts (id),
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS astronaut_alert_action_order
      ON astronaut_alert_actions (alert_id, sequence);
  

    CREATE TABLE app_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE assessment_jobs(id TEXT PRIMARY KEY REFERENCES measurements(id), attempts INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done')), error TEXT, rule_version TEXT, result TEXT);
    
    CREATE TABLE device_status(device_id TEXT PRIMARY KEY REFERENCES devices(id), status TEXT NOT NULL,
      observed_at TEXT NOT NULL, received_at TEXT NOT NULL);
  

    ALTER TABLE users ADD COLUMN requires_onboarding INTEGER NOT NULL DEFAULT 0 CHECK(requires_onboarding IN (0,1));
    CREATE TABLE security_answers(user_id TEXT NOT NULL REFERENCES users(id), question_id TEXT NOT NULL,
      answer_hash TEXT NOT NULL, PRIMARY KEY(user_id,question_id));
    CREATE TABLE recovery_attempts(subject TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0 CHECK(failures>=0));
    CREATE TABLE recovery_challenges(id TEXT PRIMARY KEY, subject TEXT NOT NULL UNIQUE, user_id TEXT REFERENCES users(id),
      question_id TEXT NOT NULL, expires_at TEXT NOT NULL, consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0,1)));
    CREATE TABLE password_reset_grants(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      expires_at TEXT NOT NULL);
  

    CREATE TABLE sensor_telemetry(device_id TEXT NOT NULL REFERENCES devices(id), reading_id TEXT NOT NULL,
      astronaut_id TEXT NOT NULL REFERENCES astronauts(id), captured_at TEXT NOT NULL, received_at TEXT NOT NULL,
      payload TEXT NOT NULL, PRIMARY KEY(device_id,reading_id));
    CREATE INDEX telemetry_history ON sensor_telemetry(astronaut_id,captured_at,device_id,reading_id);
  
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE missions FROM anon, authenticated;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE modules FROM anon, authenticated;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE users FROM anon, authenticated;
ALTER TABLE astronauts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE astronauts FROM anon, authenticated;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sessions FROM anon, authenticated;
ALTER TABLE audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE audit FROM anon, authenticated;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE devices FROM anon, authenticated;
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE indicators FROM anon, authenticated;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE measurements FROM anon, authenticated;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE login_attempts FROM anon, authenticated;
ALTER TABLE environment_catalog_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE environment_catalog_revisions FROM anon, authenticated;
ALTER TABLE environment_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE environment_profiles FROM anon, authenticated;
ALTER TABLE astronaut_environment_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE astronaut_environment_assignments FROM anon, authenticated;
ALTER TABLE astronaut_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE astronaut_alerts FROM anon, authenticated;
ALTER TABLE astronaut_alert_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE astronaut_alert_actions FROM anon, authenticated;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_settings FROM anon, authenticated;
ALTER TABLE assessment_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE assessment_jobs FROM anon, authenticated;
ALTER TABLE device_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE device_status FROM anon, authenticated;
ALTER TABLE security_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE security_answers FROM anon, authenticated;
ALTER TABLE recovery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE recovery_attempts FROM anon, authenticated;
ALTER TABLE recovery_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE recovery_challenges FROM anon, authenticated;
ALTER TABLE password_reset_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE password_reset_grants FROM anon, authenticated;
ALTER TABLE sensor_telemetry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sensor_telemetry FROM anon, authenticated;
REVOKE ALL ON SCHEMA app FROM anon, authenticated;
