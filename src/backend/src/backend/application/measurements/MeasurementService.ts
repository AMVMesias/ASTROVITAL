import { randomUUID } from "node:crypto";
import { AppError, indicatorConfig, type Activity, type EnvironmentProvider, type Indicator, type Measurement, type Origin, type Session } from "../../domain/model";
import type { Repository } from "../../domain/repository";
import { date, object, only, text } from "../../domain/validation";
import { digest } from "../../infrastructure/security/credentials";
import { AuthService } from "../auth/AuthService";

import type { createMeasurementAssessment } from "../assessment/measurementAssessment";

export class MeasurementService {
  constructor(private repo: Repository, private auth: AuthService, private environment: EnvironmentProvider, private assessment?: ReturnType<typeof createMeasurementAssessment>) {}
  manual(session: Session, input: unknown) {
    return this.repo.atomic(() => {
      const user = this.auth.requireSession(session.sessionId, "astronauta");
      return this.capture(user.astronautId!, user.missionId!, user.moduleId!, input, "manual", user.id);
    });
  }
  fromDevice(id: string, credential: string, input: unknown) {
    return this.repo.atomic(() => {
      const device = this.repo.device(id);
      if (!device?.enabled || digest(credential) !== device.credentialHash) throw new AppError(401, "DEVICE_UNAUTHORIZED", "Dispositivo o credencial no válidos.");
      const user = this.repo.users().find(user => user.astronautId === device.astronautId);
      if (!user?.enabled || user.role !== "astronauta") throw new AppError(403, "DEVICE_OWNER_UNAVAILABLE", "La cuenta vinculada no está habilitada como astronauta.");
      const result = this.capture(user.astronautId!, user.missionId!, user.moduleId!, input, "device", null, id);
      this.repo.touchDevice(id, new Date().toISOString());
      return result;
    });
  }
  /** Solo comando local de demo; no se publica como endpoint. */
  simulated(astronautId: string, input: unknown, scenario: string) {
    return this.repo.atomic(() => {
      const user = this.repo.users().find(user => user.astronautId === astronautId && user.role === "astronauta" && user.enabled);
      if (!user) throw new AppError(404, "NOT_FOUND", "Astronauta de demo no disponible.");
      return this.capture(astronautId, user.missionId!, user.moduleId!, input, "simulated", user.id, undefined, scenario);
    });
  }
  private capture(astronautId: string, missionId: string, moduleId: string, value: unknown, origin: Origin, authorId: string | null, deviceId?: string, scenario?: string) {
    const input = object(value); only(input, ["indicator", "value", "unit", "capturedAt", "activity", "note", ...(deviceId ? ["readingId"] : [])]);
    const indicator = input.indicator as Indicator;
    if (!Object.hasOwn(indicatorConfig, indicator)) throw new AppError(400, "VALIDATION", "Indicador no admitido.");
    if (origin === "manual" && indicator === "heart_rate") throw new AppError(400, "VALIDATION", "El pulso se registra mediante dispositivo o simulador.");
    if (origin === "device" && indicator !== "heart_rate") throw new AppError(400, "VALIDATION", "Este dispositivo solo admite frecuencia cardíaca.");
    const config = indicatorConfig[indicator];
    if (input.unit !== config.unit || typeof input.value !== "number" || !Number.isFinite(input.value) || input.value < config.min || input.value > config.max || (config.integer && !Number.isInteger(input.value))) throw new AppError(400, "VALIDATION", `Usa ${config.unit}, entre ${config.min} y ${config.max}.`, { value: "Valor o unidad fuera del formato de demo." });
    const capturedAt = date(input.capturedAt, "capturedAt");
    if (Date.parse(capturedAt) > Date.now() + 60_000) throw new AppError(400, "VALIDATION", "La fecha no puede estar en el futuro.");
    const activity = (input.activity ?? "rest") as Activity;
    if (!["rest", "exercise", "eva"].includes(activity)) throw new AppError(400, "VALIDATION", "Actividad inválida.");
    const note = input.note === undefined ? "" : text(input, "note", 0, 1000);
    const readingId = deviceId ? text(input, "readingId", 1, 128) : null;
    const fingerprint = digest(JSON.stringify({ indicator, value: input.value, unit: config.unit, capturedAt, activity, note }));
    // Deduplicar antes de consultar un entorno que pudo cambiar desde el primer envío.
    if (deviceId && readingId) {
      const previous = this.repo.deviceReading(deviceId, readingId);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new AppError(409, "READING_CONFLICT", "El ID de lectura ya existe con otro contenido.");
        return { measurement: previous.measurement, duplicate: true };
      }
    }
    const environment = this.environment.resolve(astronautId, capturedAt);
    if (!environment) throw new AppError(409, "ENVIRONMENT_MISSING", "No hay perfil ambiental para la fecha de captura.");
    const measurement: Measurement = { id: randomUUID(), astronautId, missionId, moduleId, indicator, value: input.value, unit: config.unit, origin, quality: "valid", capturedAt,
      receivedAt: new Date().toISOString(), authorId, deviceId: deviceId ?? null, readingId, activity, note, scenario: scenario ?? null, environment };
    this.repo.saveMeasurement(measurement, fingerprint);
    this.assessment?.record(measurement);
    return { measurement, duplicate: false };
  }
  history(session: Session, params: URLSearchParams) {
    const user = this.auth.requireSession(session.sessionId, "astronauta");
    const allowed = ["indicator", "from", "to", "limit", "offset"];
    for (const key of params.keys()) if (!allowed.includes(key)) throw new AppError(400, "VALIDATION", "Filtro no admitido.");
    const indicator = params.get("indicator") ?? undefined;
    if (indicator && !Object.hasOwn(indicatorConfig, indicator)) throw new AppError(400, "VALIDATION", "Indicador inválido.");
    const from = params.has("from") ? date(params.get("from"), "from") : undefined;
    const to = params.has("to") ? date(params.get("to"), "to") : undefined;
    if (from && to && from > to) throw new AppError(400, "VALIDATION", "El inicio debe preceder al fin.");
    const limit = Number(params.get("limit") ?? 50), offset = Number(params.get("offset") ?? 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0 || offset > 1_000_000) throw new AppError(400, "VALIDATION", "Paginación inválida.");
    return this.repo.measurements(user.astronautId!, { indicator: indicator as Indicator | undefined, from, to, limit, offset });
  }
  summary(session: Session) {
    const user = this.auth.requireSession(session.sessionId, "astronauta");
    const latest = this.repo.latest(user.astronautId!);
    const now = new Date();
    return { latest, devices: this.repo.devices(user.astronautId!), queue: this.repo.queueStatus(user.astronautId!), indicators: indicatorConfig,
      environment: this.environment.resolve(user.astronautId!, new Date().toISOString()),
      evaluation: latest.map((measurement) => ({ measurementId: measurement.id, indicator: measurement.indicator, ...this.assessment?.evaluate(measurement, now) })) };
  }
}
