import type { DatabaseSync } from "node:sqlite";
import type { Alert, AlertAction, AlertRepository } from "../../application/alerts/alerts";

export function migrateAlerts(database: DatabaseSync) {
  database.exec(`
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
      sequence INTEGER PRIMARY KEY,
      alert_id TEXT NOT NULL REFERENCES astronaut_alerts (id),
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS astronaut_alert_action_order
      ON astronaut_alert_actions (alert_id, sequence);
  `);
}

function decodeAlert(row: Record<string, unknown>): Alert {
  return { ...JSON.parse(String(row.payload)) as Alert, status: row.status as Alert["status"] };
}

export function createSqliteAlertRepository(database: DatabaseSync): AlertRepository {
  const insert = database.prepare(`
    INSERT INTO astronaut_alerts (id, mission_id, astronaut_id, status, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING
  `);
  const byOwner = database.prepare(`
    SELECT status, payload FROM astronaut_alerts WHERE id = ? AND mission_id = ? AND astronaut_id = ?
  `);
  const list = database.prepare(`
    SELECT status, payload FROM astronaut_alerts
    WHERE mission_id = ? AND astronaut_id = ? ORDER BY created_at DESC, id
  `);
  const actions = database.prepare(`
    SELECT payload FROM astronaut_alert_actions WHERE alert_id = ? ORDER BY sequence
  `);
  const addAction = database.prepare(`
    INSERT INTO astronaut_alert_actions (alert_id, payload) VALUES (?, ?)
  `);
  const update = database.prepare("UPDATE astronaut_alerts SET status = ? WHERE id = ?");

  return {
    insert(alert) {
      insert.run(alert.id, alert.missionId, alert.astronautId, alert.status, JSON.stringify(alert), alert.createdAt);
      return decodeAlert(byOwner.get(alert.id, alert.missionId, alert.astronautId)!);
    },
    list(owner) {
      return list.all(owner.missionId, owner.astronautId).map(decodeAlert);
    },
    detail(owner, id) {
      const row = byOwner.get(id, owner.missionId, owner.astronautId);
      if (!row) return undefined;
      return {
        alert: decodeAlert(row),
        actions: actions.all(id).map(({ payload }) => JSON.parse(String(payload)) as AlertAction),
      };
    },
    act(owner, id, action) {
      // Una sola escritura transaccional conserva autoría y transición juntas.
      database.exec("SAVEPOINT astronaut_alert_action");
      try {
        const row = byOwner.get(id, owner.missionId, owner.astronautId);
        if (!row || row.status === "closed") {
          database.exec("RELEASE astronaut_alert_action");
          return row ? "closed" : "not_found";
        }
        addAction.run(id, JSON.stringify(action));
        if (action.type === "track" || action.type === "close") {
          update.run(action.type === "track" ? "tracking" : "closed", id);
        }
        database.exec("RELEASE astronaut_alert_action");
        return "recorded";
      } catch (error) {
        database.exec("ROLLBACK TO astronaut_alert_action");
        database.exec("RELEASE astronaut_alert_action");
        throw error;
      }
    },
  };
}
