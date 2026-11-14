import type { NextRequest } from "next/server";
import { localServices } from "../../../../../backend/composition/local";
<<<<<<< HEAD
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
=======
import { localCatalog } from "../../../../../backend/infrastructure/environment/localCatalog";
import { createSqliteEnvironmentRepository } from "../../../../../backend/infrastructure/sqlite/environmentRepository";
import { selectEnvironment } from "../../../../../backend/application/environment/selectEnvironment";
import { handle,json,respond,requestSession,sameOrigin } from "../../../../../backend/transport/http";
import { object,only,text } from "../../../../../backend/domain/validation";
import { AppError } from "../../../../../backend/domain/model";
export const runtime="nodejs";
export function GET(request:NextRequest) {
  return handle(()=>{
    const app=localServices(),session=app.auth.requireSession(requestSession(request).sessionId,"astronauta");
    const repository=createSqliteEnvironmentRepository(app.repo.db);
    return respond({revision:localCatalog.revision,profiles:repository.list(localCatalog.revision),sources:localCatalog.sources,
      active:repository.findAt(session.missionId!,session.astronautId!,new Date().toISOString())??null,telemetryAvailable:false});
  });
}
export function POST(request:NextRequest) {
  return handle(async()=>{
    sameOrigin(request);const app=localServices(),session=requestSession(request);
    const input=object(await json(request));only(input,["scenarioId","revision"]);
    const reference={scenarioId:text(input,"scenarioId"),revision:text(input,"revision")};
    return app.repo.atomic(()=>{
      const verified=app.auth.requireSession(session.sessionId,"astronauta");
      const repository=createSqliteEnvironmentRepository(app.repo.db);
      const now=new Date();
      const result=selectEnvironment(repository,{role:"astronauta",astronautId:verified.astronautId!,missionId:verified.missionId!},reference,now);
      if(result!=="selected") throw new AppError(409,"ENVIRONMENT_CONFLICT","Perfil inexistente o fecha incompatible.");
      return respond({assignment:repository.findAt(verified.missionId!,verified.astronautId!,now.toISOString())});
    });
>>>>>>> a7784becb2c9209f3c47237b12eb7c1f106069a9
  });
}
