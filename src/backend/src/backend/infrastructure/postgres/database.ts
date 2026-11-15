import { Pool, type PoolClient } from "pg";
import { postgresConnection } from "./connection";

export type SQLInputValue = string | number | null;
let pool: Pool | undefined;
export function databasePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Configura DATABASE_URL");
  return pool ??= new Pool({ ...postgresConnection(url), max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
}

/** Parameterized PostgreSQL statements shared by the application repositories. */
export class Database {
  private depth = 0;
  constructor(readonly client: PoolClient, private readonly schema = "app") {
    if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error("Invalid database schema");
  }
  private qualify(sql: string) {
    // A transaction pooler can switch sessions: never depend on session search_path.
    return sql.replace(/\b(FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES)\s+(missions|modules|users|astronauts|sessions|audit|devices|indicators|measurements|login_attempts|environment_catalog_revisions|environment_profiles|astronaut_environment_assignments|astronaut_alerts|astronaut_alert_actions|app_settings|assessment_jobs|device_status|security_answers|recovery_attempts|recovery_challenges|password_reset_grants|sensor_telemetry)\b/gi, `$1 ${this.schema}.$2`);
  }
  prepare(sql: string) {
    const query = async (args: SQLInputValue[]) => {
      let i = 0;
      const statement = sql.replace(/\?/g, () => {
        const value = args[i++];
        return `$${i}${value === null ? "::text" : ""}`;
      });
      return this.client.query(this.qualify(statement), args);
    };
    return {
      get: async (...args: SQLInputValue[]) => (await query(args)).rows[0] as Record<string, string | number | null> | undefined,
      all: async (...args: SQLInputValue[]) => (await query(args)).rows as Record<string, string | number | null>[],
      run: async (...args: SQLInputValue[]) => ({ changes: (await query(args)).rowCount ?? 0 }),
    };
  }
  async exec(sql: string) { await this.client.query(this.qualify(sql)); }
  async atomic<T>(work: () => T | Promise<T>): Promise<T> {
    const nested = this.depth > 0;
    const name = `app_tx_${this.depth++}`;
    await this.exec(nested ? `SAVEPOINT ${name}` : "BEGIN");
    try {
      // Serialize changes to accounts, sessions and their dependent state.
      if (!nested) await this.exec("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
      const result = await work();
      await this.exec(nested ? `RELEASE SAVEPOINT ${name}` : "COMMIT");
      return result;
    } catch (error) {
      await this.exec(nested ? `ROLLBACK TO SAVEPOINT ${name}` : "ROLLBACK");
      throw error;
    } finally { this.depth--; }
  }
}
