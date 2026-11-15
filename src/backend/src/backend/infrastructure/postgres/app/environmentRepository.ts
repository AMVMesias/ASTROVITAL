import type { Database } from "../database";
import type {
  EnvironmentAssignment,
  EnvironmentAtCapture,
  EnvironmentReference,
} from "../../../application/contracts/mvp";
import type {
  EnvironmentCatalog,
  EnvironmentProfile,
} from "../../../application/environment/environment";

export async function seedEnvironmentCatalog(database: Database, catalog: EnvironmentCatalog) {
  const definition = JSON.stringify(catalog.sources);
  const insertCatalog = database.prepare(`
    INSERT INTO environment_catalog_revisions (revision, schema_version, sources) VALUES (?, ?, ?)
    ON CONFLICT (revision) DO NOTHING
  `);
  const insertProfile = database.prepare(`
    INSERT INTO environment_profiles (revision, scenario_id, definition) VALUES (?, ?, ?)
    ON CONFLICT (revision, scenario_id) DO NOTHING
  `);
  const readCatalog = database.prepare(`
    SELECT schema_version, sources FROM environment_catalog_revisions WHERE revision = ?
  `);
  const readProfiles = database.prepare(`
    SELECT scenario_id, definition FROM environment_profiles WHERE revision = ?
  `);
  const profiles = new Map(catalog.profiles.map((profile) => [profile.id, JSON.stringify(profile)]));

  (await database.exec("BEGIN"));
  try {
    (await insertCatalog.run(catalog.revision, catalog.schemaVersion, definition));
    const stored = (await readCatalog.get(catalog.revision));
    if (stored?.schema_version !== catalog.schemaVersion || stored.sources !== definition) {
      throw new Error("Conflicto de contenido para la revisión ambiental");
    }
    for (const [id, profile] of profiles) (await insertProfile.run(catalog.revision, id, profile));
    const rows = (await readProfiles.all(catalog.revision));
    if (rows.length !== profiles.size ||
        rows.some((row) => profiles.get(String(row.scenario_id)) !== row.definition)) {
      throw new Error("Conflicto de perfiles para la revisión ambiental");
    }

    (await database.exec("COMMIT"));
  } catch (error) {
    (await database.exec("ROLLBACK"));
    throw error;
  }
}

function normalizeInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new Error("La fecha ambiental debe estar en ISO 8601 UTC");
  }
  const normalized = new Date(value).toISOString();
  if (normalized !== value && normalized.replace(".000Z", "Z") !== value) {
    throw new Error("Fecha ambiental inválida");
  }
  return normalized;
}

export function createPostgresEnvironmentRepository(database: Database) {
  const list = database.prepare(`
    SELECT definition FROM environment_profiles WHERE revision = ? ORDER BY scenario_id
  `);
  const find = database.prepare(`
    SELECT definition FROM environment_profiles WHERE revision = ? AND scenario_id = ?
  `);
  const findAt = database.prepare(`
    SELECT effective_from, scenario_id, revision,
      (
        SELECT MIN(following.effective_from)
        FROM astronaut_environment_assignments AS following
        WHERE following.mission_id = current.mission_id
          AND following.astronaut_id = current.astronaut_id
          AND following.effective_from > current.effective_from
      ) AS effective_to
    FROM astronaut_environment_assignments AS current
    WHERE mission_id = ? AND astronaut_id = ? AND effective_from <= ?
    ORDER BY effective_from DESC LIMIT 1
  `);
  const append = database.prepare(`
    INSERT INTO astronaut_environment_assignments (mission_id, astronaut_id, effective_from, revision, scenario_id)
    SELECT ?, ?, ?, revision, scenario_id FROM environment_profiles
    WHERE revision = ? AND scenario_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM astronaut_environment_assignments
        WHERE mission_id = ? AND astronaut_id = ? AND effective_from >= ?
      )
  `);

  const repository = {
    async list(revision: string): Promise<EnvironmentProfile[]> {
      return (await list.all(revision)).map((row) => JSON.parse(String(row.definition)) as EnvironmentProfile);
    },
    async find(reference: EnvironmentReference): Promise<EnvironmentProfile | undefined> {
      const row = (await find.get(reference.revision, reference.scenarioId));
      return row ? JSON.parse(String(row.definition)) as EnvironmentProfile : undefined;
    },
    async findAt(missionId: string, astronautId: string, capturedAt: string): Promise<EnvironmentAssignment | undefined> {
      const instant = normalizeInstant(capturedAt);
      const row = (await findAt.get(missionId, astronautId, instant));
      if (!row) return undefined;


      return {
        reference: { scenarioId: String(row.scenario_id), revision: String(row.revision) },
        effectiveFrom: String(row.effective_from),
        effectiveTo: row.effective_to === null ? null : String(row.effective_to),
      };
    },
    async assign(missionId: string, astronautId: string, effectiveFrom: string, reference: EnvironmentReference) {
      const instant = normalizeInstant(effectiveFrom);
      const change = (await append.run(
        missionId, astronautId, instant, reference.revision, reference.scenarioId,
        missionId, astronautId, instant,
      ));
      return change.changes === 1;
    },
  } satisfies EnvironmentAtCapture & {
    list(revision: string): Promise<EnvironmentProfile[]>;
    find(reference: EnvironmentReference): Promise<EnvironmentProfile | undefined>;
    assign(missionId: string, astronautId: string, effectiveFrom: string, reference: EnvironmentReference): Promise<boolean>;
  };

  return repository;
}
