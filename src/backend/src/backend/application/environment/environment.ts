export type EnvironmentScope = "cabin" | "exterior" | "instrument";

export type EnvironmentSource = {
  name: string;
  organization: string;
  url: string;
};

export type EnvironmentCondition = {
  metric: string;
  scope: EnvironmentScope;
  value: number | { min: number; max: number } | null;
  unit?: string;
  sourceId?: string;
  evidenceType?: string;
  context?: string;
  reason?: string;
  uncertainty?: { plusMinus: number; unit: string };
};

export type EnvironmentProfile = {
  id: string;
  label: string;
  setting: string;
  conditions: readonly EnvironmentCondition[];
};

export type EnvironmentCatalog = {
  schemaVersion: string;
  revision: string;
  sources: Readonly<Record<string, EnvironmentSource>>;
  profiles: readonly EnvironmentProfile[];
};
