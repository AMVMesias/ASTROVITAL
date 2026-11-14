import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { selectEnvironment } from "../src/backend/src/backend/application/environment/selectEnvironment.ts";
import { test } from "node:test";
import input from "../data/space_environment_surface_EVA_verified.json" with { type: "json" };
import { loadDocumentaryCatalog } from "../src/backend/src/backend/infrastructure/environment/documentaryCatalog.ts";
import {
  createSqliteEnvironmentRepository, migrateEnvironment, seedEnvironmentCatalog,
} from "../src/backend/src/backend/infrastructure/sqlite/environmentRepository.ts";

test("validates all documentary scenarios and preserves absence, ranges and uncertainty", () => {
  const catalog = loadDocumentaryCatalog(input);
  assert.equal(catalog.profiles.length, 4);
  const conditions = catalog.profiles.flatMap((profile) => profile.conditions);
  assert.equal(conditions.length, 30);
  assert.equal(conditions.filter(({ value }) => value === null).length, 9);
  assert.ok(conditions.some(({ value }) => value?.min === 95 && value.max === 390));
  assert.ok(conditions.some(({ scope, uncertainty }) => scope === "instrument" && uncertainty?.plusMinus === 1));
  const wrong = structuredClone(input);
  wrong.scenarios.moon_surface.environment.gravity_surface.unit = "kg";
  assert.throws(() => loadDocumentaryCatalog(wrong), /Unidad incompatible/);
  wrong.scenarios.moon_surface.environment.gravity_surface.unit = "m/s2";
  wrong.scenarios.moon_surface.environment.gravity_surface.source_id = "unknown";
  assert.throws(() => loadDocumentaryCatalog(wrong), /Fuente inválida/);
});

test("seeds once per revision and resolves late readings at the time of capture", (context) => {
  const database = new DatabaseSync(":memory:");
  context.after(() => database.close());
  migrateEnvironment(database);
  const catalog = loadDocumentaryCatalog(input);
  seedEnvironmentCatalog(database, catalog);
  seedEnvironmentCatalog(database, catalog);
  const repository = createSqliteEnvironmentRepository(database);
  assert.equal(repository.list(catalog.revision).length, 4);

  const cabin = { scenarioId: "iss_leo", revision: catalog.revision };
  const moon = { scenarioId: "moon_surface", revision: catalog.revision };
  assert.equal(repository.assign("m1", "a1", "2026-11-14T09:00:00Z", cabin), true);
  const timestamp = new Date("2026-11-14T11:00:00Z");
  assert.equal(selectEnvironment(repository, { role: "admin" }, moon, timestamp), "forbidden");
  const astronaut = { role: "astronauta", missionId: "m1", astronautId: "a1" };
  assert.equal(selectEnvironment(repository, astronaut, moon, timestamp), "selected");
  assert.equal(repository.assign("m1", "a1", "2026-11-14T10:00:00Z", moon), false);
  assert.equal(repository.assign("m1", "a1", "2026-11-14T12:00:00Z", { ...moon, revision: "unknown" }), false);
  assert.deepEqual(repository.findAt("m1", "a1", "2026-11-14T10:00:00Z"), {
    reference: cabin, effectiveFrom: "2026-11-14T09:00:00.000Z", effectiveTo: "2026-11-14T11:00:00.000Z",
  });
  assert.deepEqual(repository.findAt("m1", "a1", "2026-11-14T11:00:00Z")?.reference, moon);
  assert.equal(repository.findAt("m1", "a2", "2026-11-14T11:00:00Z"), undefined);
  assert.equal(repository.findAt("m1", "a1", "2026-11-14T08:00:00Z"), undefined);

  const updated = structuredClone(input);
  updated.scenarios.iss_leo.name += " (revisión nueva)";
  const next = loadDocumentaryCatalog(updated);
  assert.notEqual(next.revision, catalog.revision);
  assert.throws(() => seedEnvironmentCatalog(database, { ...next, revision: catalog.revision }), /Conflicto/);
  seedEnvironmentCatalog(database, next);
  assert.equal(repository.find(cabin)?.label, input.scenarios.iss_leo.name);
});
