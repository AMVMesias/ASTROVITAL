import { onboard } from "./fixtures/auth";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteRepository } from "../src/backend/src/backend/infrastructure/sqlite/SqliteRepository";
import { seed,provisionDevice } from "../src/backend/src/backend/infrastructure/sqlite/seed";
import { createServices } from "../src/backend/src/backend/composition/local";
import { localCatalog } from "../src/backend/src/backend/infrastructure/environment/localCatalog";
import { createSqliteEnvironmentRepository } from "../src/backend/src/backend/infrastructure/sqlite/environmentRepository";

const password="integration-test-password-123",token="integration-device-000000000000000001";
function fixture(path=":memory:") {
  const repo=new SqliteRepository(path);seed(repo,"admin",password);
  const app=createServices(repo);
  const admin=app.auth.session(app.auth.login({username:"admin",password}).token);
  const user=app.users.save(admin,{username:"astro",name:"Astronauta",role:"astronauta",password:"initial-"+password});
  onboard(app,"astro","initial-"+password,password);
  const session=app.auth.session(app.auth.login({username:"astro",password}).token);
  repo.run("UPDATE astronaut_environment_assignments SET effective_from='2026-01-01T00:00:00.000Z' WHERE astronaut_id=?",user.astronautId);
  return {...app,admin,user,session};
}
test("actualiza una base v1 existente sin perder cuentas, lecturas o pendientes",()=>{
  const directory=mkdtempSync(join(tmpdir(),"nasa-upgrade-")),path=join(directory,"legacy.sqlite");
  const f=fixture(path);
  const saved=f.measurements.manual(f.session,{indicator:"sleep",value:7,unit:"h",capturedAt:"2026-01-01T08:00:00Z"}).measurement;
  // Reconstrucción de la estructura previa en una base temporal, conservando datos v1.
  f.repo.db.exec(`DROP TABLE password_reset_grants; DROP TABLE recovery_challenges; DROP TABLE recovery_attempts; DROP TABLE security_answers;
    ALTER TABLE users DROP COLUMN requires_onboarding;
    DROP TABLE assessment_jobs; DROP TABLE device_status; DROP TABLE local_settings;
    DROP TABLE astronaut_alert_actions; DROP TABLE astronaut_alerts;
    DROP TABLE astronaut_environment_assignments; DROP TABLE environment_profiles; DROP TABLE environment_catalog_revisions;
    DELETE FROM schema_migrations WHERE id!='001_person1_local';`);
  f.repo.close();
  const reopened=new SqliteRepository(path);
  try {
    assert.equal(reopened.all("SELECT * FROM schema_migrations").length,5);
    assert.equal(reopened.pending(100)[0].id,saved.id);
    assert.equal(reopened.get("SELECT status FROM assessment_jobs WHERE id=?",saved.id)?.status,"pending");
    assert.equal(reopened.account(f.user.id)?.username,"astro");
    seed(reopened,"admin",password);
    seed(reopened,"admin",password);
    assert.equal(reopened.all("SELECT * FROM measurements").length,1);
    assert.equal(reopened.all("SELECT * FROM astronaut_environment_assignments").length,1);
  } finally {reopened.close();rmSync(directory,{recursive:true});}
});
test("composición real: cuatro escenarios, asignación histórica y revisión sincronizable",()=>{
  const f=fixture();try {
    const environments=createSqliteEnvironmentRepository(f.repo.db);
    assert.equal(environments.list(localCatalog.revision).length,4);
    assert.equal(environments.assign(f.user.missionId!,f.user.astronautId!,"2026-02-01T00:00:00Z",{scenarioId:"moon_surface",revision:localCatalog.revision}),true);
    const old=f.measurements.manual(f.session,{indicator:"sleep",unit:"h",value:7,capturedAt:"2026-01-15T08:00:00Z"}).measurement;
    const recent=f.measurements.manual(f.session,{indicator:"sleep",unit:"h",value:7,capturedAt:"2026-02-15T08:00:00Z"}).measurement;
    assert.equal(old.environment.scenarioId,"iss_leo");assert.equal(recent.environment.scenarioId,"moon_surface");
    assert.equal(old.environment.profileVersion,localCatalog.revision);
    assert.equal(f.queue.pending()[0].payload.environment.profileVersion,localCatalog.revision);
    assert.equal(old.environment.telemetryAvailable,false);
  } finally {f.repo.close();}
});
test("evaluación fallida deja trabajo pendiente y reintenta sin duplicar medición ni aviso",async()=>{
  const f=fixture();try {
    const value=f.measurements.manual(f.session,{indicator:"sleep",unit:"h",value:7,capturedAt:"2026-01-15T08:00:00Z"}).measurement;
    f.repo.db.exec("CREATE TRIGGER fail_alert BEFORE INSERT ON astronaut_alerts BEGIN SELECT RAISE(ABORT,'test'); END;");
    assert.equal((await f.assessments.process(value.id)).status,"pending");
    assert.equal(f.repo.all("SELECT * FROM measurements").length,1);
    assert.equal(f.queue.pending().length,1);
    f.repo.db.exec("DROP TRIGGER fail_alert");
    assert.equal((await f.assessments.process(value.id)).status,"done");
    await f.assessments.process(value.id);
    assert.equal(f.repo.all("SELECT * FROM astronaut_alerts").length,1);
    assert.equal(f.repo.get("SELECT attempts FROM assessment_jobs WHERE id=?",value.id)?.attempts,2);
  } finally {f.repo.close();}
});
test("estados de sensor no crean pulso cero ni permiten sobrescribir estado reciente con reenvío viejo",()=>{
  const f=fixture();try {
    provisionDevice(f.repo,"astro","esp32",token);
    const measurement=f.measurements.fromDevice("esp32",token,{indicator:"heart_rate",unit:"bpm",value:68,readingId:"boot-1",capturedAt:"2026-01-01T08:00:00Z"});
    f.measurements.reportStatus("esp32",token,{status:"no_contact",observedAt:"2026-01-01T09:00:00Z"});
    f.measurements.fromDevice("esp32",token,{indicator:"heart_rate",unit:"bpm",value:68,readingId:"boot-1",capturedAt:"2026-01-01T08:00:00Z"});
    assert.equal(f.repo.get("SELECT status FROM device_status WHERE device_id='esp32'")?.status,"no_contact");
    assert.equal(f.measurements.summary(f.session).latest[0].id,measurement.measurement.id);
    assert.equal(f.queue.pending().length,1);
    assert.throws(()=>f.measurements.reportStatus("esp32","wrong",{status:"no_signal",observedAt:"2026-01-01T09:00:00Z"}));
    f.repo.run("UPDATE devices SET enabled=0 WHERE id='esp32'");
    assert.throws(()=>f.measurements.reportStatus("esp32",token,{status:"no_signal",observedAt:"2026-01-01T09:00:00Z"}));
  } finally {f.repo.close();}
});
