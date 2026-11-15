import type { Session } from "../../domain/model";
import { AppError } from "../../domain/model";
import type { PostgresRepository } from "../../infrastructure/postgres/app/PostgresRepository";
import { createPostgresEnvironmentRepository } from "../../infrastructure/postgres/app/environmentRepository";
import type { AuthService } from "../auth/AuthService";
import type { TelemetryService } from "../measurements/TelemetryService";
import { analyzeTelemetry, type RadiationRef, type TelemetrySample } from "./telemetryDecisionTree";
import radiation from "../../../../../../data/radlab_reference_summaries.json";
import { demoRules } from "./AssessmentService";

export class TelemetryDecisionService {
  constructor(private repo:PostgresRepository, private auth:AuthService, private telemetry:TelemetryService) {}
  async evaluate(session:Session, now=new Date()) {
    return this.repo.atomic(async()=>{
      const user=await this.auth.requireSession(session.sessionId,"astronauta");
      const environments=createPostgresEnvironmentRepository(this.repo.db);
      const assignment=await environments.findAt(user.missionId!,user.astronautId!,now.toISOString());
      if(!assignment) throw new AppError(409,"ENVIRONMENT_MISSING","Selecciona un entorno antes de consultar el DSS.");
      const profile=await environments.find(assignment.reference);
      if(!profile) throw new AppError(409,"ENVIRONMENT_MISSING","El perfil histórico asignado no está disponible.");
      const history=await this.telemetry.history(session,new URLSearchParams({limit:"100",from:assignment.effectiveFrom,to:now.toISOString()}));
      const devices=await this.repo.devices(user.astronautId!);
      const samples=(history.samples as TelemetrySample[]).map(sample=>{
        const signal=devices.find(device=>device.id===sample.deviceId)?.signal;
        if(!signal || Date.parse(signal.observedAt)<Date.parse(sample.capturedAt) || signal.status==="valid") return sample;
        const fields={...sample.fields,estado_ecg_x50:0};
        if(signal.status==="disconnected") Object.assign(fields,{estado_resp_x50:0,estado_oxi_x50:0});
        return {...sample,fields};
      });
      const scenarioId=assignment.reference.scenarioId;
      const supplied=(radiation.scenarios as Record<string,RadiationRef>)[scenarioId];
      const result=analyzeTelemetry({samples,now,scenarioId,scenarioLabel:profile.label,
        scenarioScope:["moon_surface","mars_surface"].includes(scenarioId)?"exterior":"cabin",
        scenarioStartedAt:assignment.effectiveFrom,maxAgeMs:demoRules.heart_rate.maxAgeMs,
        radiation:supplied?{...supplied,provenance:radiation.provenance.status}:null});
      return {...result,assignment,rules:{freshnessSeconds:demoRules.heart_rate.maxAgeMs/1000,trendWindowSeconds:120,maximumSamples:100},
        radiationProvenance:radiation.provenance,
        limitations:[...result.limitations,"Los percentiles de radiación provienen del resumen aportado; no se han recalculado sin sus CSV originales.","Una señal de desconexión posterior invalida las estimaciones actuales; los datos crudos permanecen en el historial."]};
    });
  }
}
