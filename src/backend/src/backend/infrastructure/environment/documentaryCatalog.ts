import { createHash } from "node:crypto";
import type {
  EnvironmentCatalog,
  EnvironmentCondition,
  EnvironmentScope,
} from "../../application/environment/environment";

type Field = readonly [EnvironmentScope, string?];

const fields: Readonly<Record<string, Field>> = {
  temperature_c: ["cabin", "°C"],
  co2_ppm: ["cabin", "ppm"],
  cabin_pressure_pa: ["cabin", "Pa"],
  cabin_temperature_c: ["cabin", "°C"],
  cabin_relative_humidity_pct: ["cabin", "%"],
  cabin_co2_ppm: ["cabin", "ppm"],
  effective_gravity: ["cabin", "m/s2"],
  radiation_gcr_equivalent_rate_range: ["instrument", "mSv/day"],
  radiation_mission_total_equivalent_range: ["instrument", "mSv"],
  radiation_equivalent_rate_comparison: ["instrument", "µSv/day"],
  radiation_gcr_component_comparison: ["instrument", "µSv/day"],
  gravity_surface: ["exterior", "m/s2"],
  gravity_surface_mean: ["exterior", "m/s2"],
  gravity_relative_to_earth: ["exterior", "g_earth"],
  exterior_surface_temperature_equator_range: ["exterior", "K"],
  exosphere_surface_pressure_night: ["exterior", "bar"],
  radiation_total_absorbed_dose_rate: ["instrument", "µGy/hour"],
  radiation_neutral_absorbed_dose_rate: ["instrument", "µGy/hour"],
  radiation_equivalent_dose_rate: ["instrument", "µSv/day"],
  exterior_surface_pressure_mean_radius: ["exterior", "mbar"],
  exterior_surface_pressure_seasonal_reference_range: ["exterior", "mbar"],
  exterior_atmosphere_co2_volume_fraction: ["exterior", "% vol"],
  exterior_mean_temperature: ["exterior", "K"],
  exterior_radiation_absorbed_dose_gcr_rate: ["instrument", "µGy/day"],
  exterior_atmosphere_o2_volume_fraction: ["exterior", "% vol"],
  exterior_viking1_diurnal_air_temperature_range: ["exterior", "K"],
  exterior_viking_dust_storm_wind_speed_range: ["exterior", "m/s"],
};

const scenarioIds = ["deep_space_transit", "iss_leo", "moon_surface", "mars_surface"];

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Objeto inválido: ${label}`);
  }

  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Texto inválido: ${label}`);
  }

  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Número inválido: ${label}`);
  }

  return value;
}

function normalizeCondition(
  metric: string,
  input: unknown,
  sources: EnvironmentCatalog["sources"],
): EnvironmentCondition {
  if (!Object.hasOwn(fields, metric)) throw new Error(`Variable no mapeada: ${metric}`);
  const [scope, expectedUnit] = fields[metric];
  const raw = record(input, metric);
  if ((raw.unit !== undefined || raw.value !== null) && raw.unit !== expectedUnit) {
    throw new Error(`Unidad incompatible: ${metric}`);
  }

  const sourceId = raw.source_id === undefined ? undefined : string(raw.source_id, metric);
  if ((sourceId && !Object.hasOwn(sources, sourceId)) || (!sourceId && raw.value !== null)) {
    throw new Error(`Fuente inválida: ${metric}`);
  }

  let value: EnvironmentCondition["value"];
  if (raw.value === null || typeof raw.value === "number") {
    value = raw.value === null ? null : finite(raw.value, metric);
  } else {
    const range = record(raw.value, metric);
    const min = finite(range.min, metric);
    const max = finite(range.max, metric);
    if (min > max) throw new Error(`Rango inválido: ${metric}`);
    value = { min, max };
  }

  const condition: EnvironmentCondition = {
    metric, scope, value,
    unit: expectedUnit,
    sourceId,
    evidenceType: raw.evidence_type === undefined ? undefined : string(raw.evidence_type, metric),
    context: raw.context === undefined ? undefined : string(raw.context, metric),
    reason: value === null ? string(raw.reason ?? raw.description, metric) : undefined,
  };
  if (raw.uncertainty !== undefined) {
    const uncertainty = record(raw.uncertainty, metric);
    const plusMinus = finite(uncertainty.plus_minus, metric);
    if (plusMinus < 0 || uncertainty.unit !== expectedUnit || !expectedUnit) {
      throw new Error(`Incertidumbre inválida: ${metric}`);
    }
    condition.uncertainty = { plusMinus, unit: expectedUnit };
  }

  return condition;
}

export function loadDocumentaryCatalog(input: unknown): EnvironmentCatalog {
  const raw = record(input, "catálogo");
  if (raw.schema_version !== "1.1.0") throw new Error("Versión de esquema no compatible");

  const sources = Object.fromEntries(
    Object.entries(record(raw.sources, "fuentes")).map(([id, inputSource]) => {
      const source = record(inputSource, id);
      const url = string(source.url, id);
      if (new URL(url).protocol !== "https:") throw new Error(`URL inválida: ${id}`);

      return [id, {
        name: string(source.name, id),
        organization: string(source.organization, id),
        url,
      }];
    }),
  );
  const scenarios = record(raw.scenarios, "escenarios");
  if (Object.keys(scenarios).length !== scenarioIds.length ||
      scenarioIds.some((id) => !Object.hasOwn(scenarios, id))) {
    throw new Error("El catálogo debe incluir los cuatro escenarios acordados");
  }

  const profiles = scenarioIds.map((id) => {
    const scenario = record(scenarios[id], id);
    const conditions = Object.entries(record(scenario.environment, id));
    if (conditions.length === 0) throw new Error(`Escenario sin referencias: ${id}`);

    return {
      id,
      label: string(scenario.name, id),
      setting: string(scenario.setting, id),
      conditions: conditions.map(([metric, entry]) => normalizeCondition(metric, entry, sources)),
    };
  });

  return {
    schemaVersion: raw.schema_version,
    revision: createHash("sha256").update(JSON.stringify({ sources, profiles })).digest("hex"),
    sources,
    profiles,
  };
}
