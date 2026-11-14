import { HistoricalEnvironmentProvider } from "../../../../../backend/infrastructure/environment/HistoricalEnvironmentProvider";
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
    return respond({schemaVersion:localCatalog.schemaVersion,revision:localCatalog.revision,profiles:repository.list(localCatalog.revision),sources:localCatalog.sources,
      assignment:repository.findAt(session.missionId!,session.astronautId!,new Date().toISOString())??null,
      active:new HistoricalEnvironmentProvider(app.repo).resolve(session.astronautId!,new Date().toISOString()),telemetryAvailable:false});
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

/** Compatibilidad con el selector remoto: usa la revisión vigente del catálogo. */
export function PUT(request:NextRequest) {
  return handle(async()=>{
    sameOrigin(request);
    const input=object(await json(request));only(input,["scenarioId"]);
    const scenarioId=text(input,"scenarioId");
    const app=localServices();
    const session=app.auth.requireSession(requestSession(request).sessionId,"astronauta");
    return app.repo.atomic(()=>{
      const repository=createSqliteEnvironmentRepository(app.repo.db);
      if(!repository.find({scenarioId,revision:localCatalog.revision})) throw new AppError(400,"UNKNOWN_SCENARIO","El escenario no pertenece al catálogo.");
      const now=new Date();
      const provider=new HistoricalEnvironmentProvider(app.repo);
      const active=provider.resolve(session.astronautId!,now.toISOString());
      if(active?.scenarioId===scenarioId && active.profileVersion===localCatalog.revision) return respond({active});
      const result=selectEnvironment(repository,{role:"astronauta",astronautId:session.astronautId!,missionId:session.missionId!},{scenarioId,revision:localCatalog.revision},now);
      if(result!=="selected") throw new AppError(409,"ENVIRONMENT_CONFLICT","Perfil inexistente o fecha incompatible.");
      return respond({active:provider.resolve(session.astronautId!,now.toISOString())});
    });
  });
}
