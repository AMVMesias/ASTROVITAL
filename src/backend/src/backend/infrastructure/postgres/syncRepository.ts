import type { Pool } from "pg";
import type { EnvironmentCatalog } from "../../application/environment/environment";
import type { MeasurementReceiver } from "../../application/sync/syncMeasurements";

export async function provisionSyncSchema(pool: Pool, catalog: EnvironmentCatalog) {
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sync_catalog_revisions (
        revision TEXT PRIMARY KEY,
        schema_version TEXT NOT NULL,
        sources JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_environment_profiles (
        revision TEXT NOT NULL REFERENCES sync_catalog_revisions (revision),
        scenario_id TEXT NOT NULL,
        definition JSONB NOT NULL,
        PRIMARY KEY (revision, scenario_id)
      );
      CREATE TABLE IF NOT EXISTS synced_measurements (
        measurement_id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        revision TEXT NOT NULL,
        payload JSONB NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        FOREIGN KEY (revision, scenario_id) REFERENCES sync_environment_profiles (revision, scenario_id)
      );
    `);
    await connection.query(`
      INSERT INTO sync_catalog_revisions VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (revision) DO NOTHING
    `, [catalog.revision, catalog.schemaVersion, JSON.stringify(catalog.sources)]);
    const revision = await connection.query(`
      SELECT 1 FROM sync_catalog_revisions WHERE revision = $1 AND schema_version = $2 AND sources = $3::jsonb
    `, [catalog.revision, catalog.schemaVersion, JSON.stringify(catalog.sources)]);
    if (revision.rowCount !== 1) throw new Error("Conflicto de revisión ambiental");

    for (const profile of catalog.profiles) {
      const values = [catalog.revision, profile.id, JSON.stringify(profile)];
      await connection.query(`
        INSERT INTO sync_environment_profiles VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (revision, scenario_id) DO NOTHING
      `, values);
      const existing = await connection.query(`
        SELECT 1 FROM sync_environment_profiles WHERE revision = $1 AND scenario_id = $2 AND definition = $3::jsonb
      `, values);
      if (existing.rowCount !== 1) throw new Error("Conflicto de perfil ambiental");
    }
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

export function createPostgresMeasurementReceiver(pool: Pool): MeasurementReceiver {
  return {
    async store(measurement) {
      const values = [
        measurement.id, measurement.missionId, measurement.environment.scenarioId,
        measurement.environment.profileVersion, JSON.stringify(measurement), measurement.environment.profileId,
      ];
      const inserted = await pool.query(`
        INSERT INTO synced_measurements (measurement_id, mission_id, scenario_id, revision, payload)
        SELECT $1, $2, scenario_id, revision, $5::jsonb FROM sync_environment_profiles
        WHERE scenario_id = $3 AND revision = $4 AND scenario_id = $6
        ON CONFLICT (measurement_id) DO NOTHING
      `, values);
      if (inserted.rowCount === 1) return "accepted";

      const existing = await pool.query<{ identical: boolean }>(`
        SELECT mission_id = $2 AND scenario_id = $3 AND revision = $4 AND payload = $5::jsonb AS identical
        FROM synced_measurements WHERE measurement_id = $1
      `, values.slice(0, 5));
      if (!existing.rows[0]) return "unknown_environment";
      return existing.rows[0].identical ? "accepted" : "conflict";
    },
  };
}
