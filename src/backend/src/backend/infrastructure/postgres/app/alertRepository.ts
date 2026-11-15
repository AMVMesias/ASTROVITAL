import type { Database } from "../database";
import type { Alert, AlertAction, AlertRepository } from "../../../application/alerts/alerts";
import type { Measurement } from "../../../domain/model";

function decodeAlert(row: Record<string, unknown>): Alert {
  const alert={ ...JSON.parse(String(row.payload)) as Alert, status: row.status as Alert["status"] };
  if(row.measurement_payload){
    const m=JSON.parse(String(row.measurement_payload)) as Measurement;
    alert.reading={indicator:m.indicator,value:m.value,unit:m.unit,capturedAt:m.capturedAt,activity:m.activity,origin:m.origin,environment:m.environment};
  }
  return alert;
}

export function createPostgresAlertRepository(database: Database): AlertRepository {
  const insert = database.prepare(`
    INSERT INTO astronaut_alerts (id, mission_id, astronaut_id, status, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING
  `);
  const byOwner = database.prepare(`
    SELECT a.status, a.payload, m.payload AS measurement_payload FROM astronaut_alerts a
    LEFT JOIN measurements m ON m.id=a.payload::jsonb->>'measurementId' AND m.astronaut_id=a.astronaut_id
    WHERE a.id = ? AND a.mission_id = ? AND a.astronaut_id = ?
  `);
  const list = database.prepare(`
    SELECT a.status, a.payload, m.payload AS measurement_payload FROM astronaut_alerts a
    LEFT JOIN measurements m ON m.id=a.payload::jsonb->>'measurementId' AND m.astronaut_id=a.astronaut_id
    WHERE a.mission_id = ? AND a.astronaut_id = ? ORDER BY a.created_at DESC, a.id
  `);
  const actions = database.prepare(`
    SELECT payload FROM astronaut_alert_actions WHERE alert_id = ? ORDER BY sequence
  `);
  const addAction = database.prepare(`
    INSERT INTO astronaut_alert_actions (alert_id, payload) VALUES (?, ?)
  `);
  const update = database.prepare("UPDATE astronaut_alerts SET status = ? WHERE id = ?");

  return {
    async insert(alert) {
      (await insert.run(alert.id, alert.missionId, alert.astronautId, alert.status, JSON.stringify(alert), alert.createdAt));
      return decodeAlert((await byOwner.get(alert.id, alert.missionId, alert.astronautId))!);
    },
    async list(owner) {
      return (await list.all(owner.missionId, owner.astronautId)).map(decodeAlert);
    },
    async detail(owner, id) {
      const row = (await byOwner.get(id, owner.missionId, owner.astronautId));
      if (!row) return undefined;
      return {
        alert: decodeAlert(row),
        actions: (await actions.all(id)).map(({ payload }) => JSON.parse(String(payload)) as AlertAction),
      };
    },
    async act(owner, id, action) {
      // Una sola escritura transaccional conserva autoría y transición juntas.
      return database.atomic(async () => {
        const row = (await byOwner.get(id, owner.missionId, owner.astronautId));
        if (!row || row.status === "closed") {
          
          return row ? "closed" : "not_found";
        }
        (await addAction.run(id, JSON.stringify(action)));
        if (action.type === "track" || action.type === "close") {
          (await update.run(action.type === "track" ? "tracking" : "closed", id));
        }
        
        return "recorded";
      });
    },
  };
}
