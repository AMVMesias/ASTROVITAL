import type { NextRequest } from "next/server";
import { createAstronautAlerts } from "../../../../../../backend/application/alerts/alerts";
import { localServices } from "../../../../../../backend/composition/local";
import { AppError } from "../../../../../../backend/domain/model";
import { object, only, text } from "../../../../../../backend/domain/validation";
import { handle, json, requestSession, respond, sameOrigin } from "../../../../../../backend/transport/http";

export const runtime = "nodejs";

function ownedAlerts(request: NextRequest) {
  const session = requestSession(request, "astronauta");
  return createAstronautAlerts(localServices().alerts, {
    role: "astronauta", userId: session.id, missionId: session.missionId!, astronautId: session.astronautId!,
  })!;
}

type Context = { params: Promise<{ id: string }> };

export function GET(request: NextRequest, context: Context) {
  return handle(async () => {
    const result = ownedAlerts(request).detail((await context.params).id);
    if (!result) throw new AppError(404, "NOT_FOUND", "Aviso no encontrado.");
    return respond(result);
  });
}

export function POST(request: NextRequest, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const input = object(await json(request));
    only(input, ["type", "note"]);
    const type = input.type;
    if (type !== "observation" && type !== "repeat" && type !== "track" && type !== "close") {
      throw new AppError(400, "VALIDATION", "Acción de aviso no válida.");
    }
    const note = input.note === undefined ? undefined : text(input, "note", 0, 1000);
    const alerts = ownedAlerts(request);
    const { id } = await context.params;
    const outcome = alerts.act(id, type, note, new Date());
    if (outcome === "not_found") throw new AppError(404, "NOT_FOUND", "Aviso no encontrado.");
    if (outcome === "closed") throw new AppError(409, "ALERT_CLOSED", "El aviso ya está cerrado.");
    if (outcome === "invalid_note") throw new AppError(400, "VALIDATION", "Nota no válida.");
    return respond(alerts.detail(id));
  });
}
