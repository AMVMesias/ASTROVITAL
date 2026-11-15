import type { PoolConfig } from "pg";

/** Trust the Supabase CA without disabling certificate or hostname verification. */
export function postgresConnection(connectionString: string): PoolConfig {
  const ca = process.env.DATABASE_CA;
  if (!ca) return { connectionString };
  const url = new URL(connectionString);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}
