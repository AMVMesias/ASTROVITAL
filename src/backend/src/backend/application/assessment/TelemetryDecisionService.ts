import type { Session } from "../../domain/model";
import { AppError } from "../../domain/model";
import type { PostgresRepository } from "../../infrastructure/postgres/app/PostgresRepository";
import { createPostgresEnvironmentRepository } from "../../infrastructure/postgres/app/environmentRepository";
import type { AuthService } from "../auth/AuthService";
import type { TelemetryService } from "../measurements/TelemetryService";
import { analyzeTelemetry, telemetryQualityRules, type RadiationRef, type TelemetrySample } from "./telemetryDecisionTree";
import radiation from "../../../../../../data/radlab_reference_summaries.json";
import { demoRules } from "./AssessmentService";
import { analyzeMissionContext, validateMissionContext, CONTEXT_TTL_MS, type MissionContext } from "./missionContext";

export class TelemetryDecisionService {
  constructor(private repo:PostgresRepository, private auth:AuthService, private telemetry:TelemetryService) {}
  private contextKey(user:Session) { return JSON.stringify(["mission-context-1",user.missionId,user.astronautId]); }
  private async currentAssignment(user:Session,now:Date) {
    const assignment=await createPostgresEnvironmentRepository(this.repo.db).findAt(user.missionId!,user.astronautId!,now.toISOString());
    if(!assignment)throw new AppError(409,"ENVIRONMENT_MISSING","Selecciona un entorno antes de registrar el contexto.");
    return assignment;
  }
  async saveContext(session:Session,value:unknown,now=new Date()) {
    return this.repo.atomic(async()=>{
      const user=await this.auth.requireSession(session.sessionId,"astronauta");
      const data=validateMissionContext(value,now),assignment=await this.currentAssignment(user,now);
      if(data.scenarioId!==assignment.reference.scenarioId||data.assignmentFrom!==assignment.effectiveFrom)throw new AppError(409,"CONTEXT_CHANGED","El escenario cambió; actualiza antes de registrar datos.");
      if(now.getTime()-Date.parse(data.capturedAt)>CONTEXT_TTL_MS)throw new AppError(400,"VALIDATION","El registro supera los 5 minutos de vigencia del prototipo. Obtén datos nuevos.");
      const snapshot={data,recordedAt:now.toISOString(),revision:assignment.reference.revision};
      await this.repo.db.prepare("INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(this.contextKey(user),JSON.stringify(snapshot));
      await this.repo.audit(user.id,user.id,"dss.context.saved");
      return {status:"recorded",context:data,recordedAt:snapshot.recordedAt};
    });
  }
  async clearContext(session:Session) {
    return this.repo.atomic(async()=>{
      const user=await this.auth.requireSession(session.sessionId,"astronauta");
      await this.repo.db.prepare("DELETE FROM app_settings WHERE key=?").run(this.contextKey(user));
      await this.repo.audit(user.id,user.id,"dss.context.cleared");
      return {status:"cleared"};
    });
  }
  async compare(session:Session,now=new Date()) {
    // One common sensor snapshot for all counterfactual contexts. No writes or fabricated sensor readings.
    const base=await this.evaluate(session,now);
    const initial:MissionContext={scenarioId:base.scenario.id,assignmentFrom:base.assignment.effectiveFrom,capturedAt:now.toISOString(),sourceNote:"Ejemplo sintético / synthetic example",origin:"simulated",location:"cabin",activity:"exercise",phase:"inflight",pressureKpa:101.325,oxygenPercent:21,co2Mmhg:1,co2WindowMinutes:60,measuredHrMax:180};
    const examples=[{id:"nominal",context:initial},{id:"low_oxygen",context:{...initial,pressureKpa:56.5,oxygenPercent:21}},{id:"high_co2",context:{...initial,co2Mmhg:5}}];
    return {simulated:true,telemetry:base.telemetry,physiologicalLevel:base.state.level,timestamp:base.timestamp,
      examples:examples.map(e=>({id:e.id,result:analyzeMissionContext(e.context,base,base.assignment.effectiveFrom,now)}))};
  }
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
      const row=await this.repo.db.prepare("SELECT value FROM app_settings WHERE key=?").get(this.contextKey(user));
      const stored=row?.value?JSON.parse(String(row.value)) as {data:MissionContext;recordedAt:string;revision:string}:null;
      const contextual=analyzeMissionContext(stored?.revision===assignment.reference.revision?stored.data:null,result,assignment.effectiveFrom,now);
      return {...result,assignment,contextual,contextRecordedAt:stored?.revision===assignment.reference.revision&&contextual.input?stored.recordedAt:null,rules:{freshnessSeconds:demoRules.heart_rate.maxAgeMs/1000,trendWindowSeconds:120,maximumSamples:100,signalQuality:telemetryQualityRules},
        radiationProvenance:radiation.provenance,
        limitations:[...result.limitations,"Los percentiles de radiación provienen del resumen aportado; no se han recalculado sin sus CSV originales.","Una señal de desconexión posterior invalida las estimaciones actuales; los datos crudos permanecen en el historial."]};
    });
  }
}
