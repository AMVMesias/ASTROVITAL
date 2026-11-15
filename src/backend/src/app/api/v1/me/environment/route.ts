import { HistoricalEnvironmentProvider } from "../../../../../backend/infrastructure/environment/HistoricalEnvironmentProvider";
import type { NextRequest } from "next/server";
import { services } from "../../../../../backend/composition/services";
import { catalog } from "../../../../../backend/infrastructure/environment/catalog";
import { createPostgresEnvironmentRepository } from "../../../../../backend/infrastructure/postgres/app/environmentRepository";
import { selectEnvironment } from "../../../../../backend/application/environment/selectEnvironment";
import { handle,json,respond,requestSession,sameOrigin } from "../../../../../backend/transport/http";
import { object,only,text } from "../../../../../backend/domain/validation";
import { AppError } from "../../../../../backend/domain/model";
export const runtime="nodejs";
export function GET(request:NextRequest) {
  return handle(async ()=>{
    const app=services(),session=(await app.auth.requireSession((await requestSession(request)).sessionId,"astronauta"));
    const repository=createPostgresEnvironmentRepository(app.repo.db);
    return respond({schemaVersion:catalog.schemaVersion,revision:catalog.revision,profiles:(await repository.list(catalog.revision)),sources:catalog.sources,
      assignment:(await repository.findAt(session.missionId!,session.astronautId!,new Date().toISOString()))??null,
      active:(await new HistoricalEnvironmentProvider(app.repo).resolve(session.astronautId!,new Date().toISOString())),telemetryAvailable:false});
  });
}
export function POST(request:NextRequest) {
  return handle(async()=>{
    sameOrigin(request);const app=services(),session=(await requestSession(request));
    const input=object(await json(request));only(input,["scenarioId","revision"]);
    const reference={scenarioId:text(input,"scenarioId"),revision:text(input,"revision")};
    return (await app.repo.atomic(async ()=>{
      const verified=(await app.auth.requireSession(session.sessionId,"astronauta"));
      const repository=createPostgresEnvironmentRepository(app.repo.db);
      const now=new Date();
      const result=(await selectEnvironment(repository,{role:"astronauta",astronautId:verified.astronautId!,missionId:verified.missionId!},reference,now));
      if(result!=="selected") throw new AppError(409,"ENVIRONMENT_CONFLICT","Perfil inexistente o fecha incompatible.");
      return respond({assignment:(await repository.findAt(verified.missionId!,verified.astronautId!,now.toISOString()))});
    }));
  });
}

/** Compatibilidad con el selector remoto: usa la revisión vigente del catálogo. */
export function PUT(request:NextRequest) {
  return handle(async()=>{
    sameOrigin(request);
    const input=object(await json(request));only(input,["scenarioId"]);
    const scenarioId=text(input,"scenarioId");
    const app=services();
    const session=(await app.auth.requireSession((await requestSession(request)).sessionId,"astronauta"));
    return (await app.repo.atomic(async ()=>{
      const repository=createPostgresEnvironmentRepository(app.repo.db);
      if(!(await repository.find({scenarioId,revision:catalog.revision}))) throw new AppError(400,"UNKNOWN_SCENARIO","El escenario no pertenece al catálogo.");
      const now=new Date();
      const provider=new HistoricalEnvironmentProvider(app.repo);
      const active=(await provider.resolve(session.astronautId!,now.toISOString()));
      if(active?.scenarioId===scenarioId && active.profileVersion===catalog.revision) return respond({active});
      const result=(await selectEnvironment(repository,{role:"astronauta",astronautId:session.astronautId!,missionId:session.missionId!},{scenarioId,revision:catalog.revision},now));
      if(result!=="selected") throw new AppError(409,"ENVIRONMENT_CONFLICT","Perfil inexistente o fecha incompatible.");
      return respond({active:(await provider.resolve(session.astronautId!,now.toISOString()))});
    }));
  });
}
