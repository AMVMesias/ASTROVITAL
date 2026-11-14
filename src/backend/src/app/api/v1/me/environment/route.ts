import type { NextRequest } from "next/server";
import { localServices } from "../../../../../backend/composition/local";
import { AppError } from "../../../../../backend/domain/model";
import { object, only, text } from "../../../../../backend/domain/validation";
import { selectEnvironment } from "../../../../../backend/application/environment/selectEnvironment";
import { handle, json, requestSession, respond, sameOrigin } from "../../../../../backend/transport/http";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return handle(() => {
    const session = requestSession(request, "astronauta");
    const { environments, catalog } = localServices();
    return respond({ ...catalog, active: environments.resolve(session.astronautId!, new Date().toISOString()) });
  });
}

export function PUT(request: NextRequest) {
  return handle(async () => {
    sameOrigin(request);
    const input = object(await json(request));
    only(input, ["scenarioId"]);
    const scenarioId = text(input, "scenarioId");
    const session = requestSession(request, "astronauta");
    const { assignments, catalog, environments } = localServices();
    if (!catalog.profiles.some((profile) => profile.id === scenarioId)) {
      throw new AppError(400, "UNKNOWN_SCENARIO", "El escenario no pertenece al catálogo.");
    }
    const now = new Date();
    const active = environments.resolve(session.astronautId!, now.toISOString());
    if (active?.scenarioId === scenarioId && active.profileVersion === catalog.revision) return respond({ active });

    const result = selectEnvironment(assignments, {
      role: "astronauta", astronautId: session.astronautId!, missionId: session.missionId!,
    }, { scenarioId, revision: catalog.revision }, now);
    if (result !== "selected") throw new AppError(409, "ENVIRONMENT_CONFLICT", "Vuelve a intentar seleccionar el entorno.");
    return respond({ active: environments.resolve(session.astronautId!, now.toISOString()) });
  });
}
