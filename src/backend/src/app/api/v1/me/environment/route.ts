import type { NextRequest } from "next/server";
import { localServices } from "../../../../../backend/composition/local";
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
  });
}
