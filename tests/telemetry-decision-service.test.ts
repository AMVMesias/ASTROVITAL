import assert from "node:assert/strict";
import {test} from "node:test";
import {TelemetryDecisionService} from "../src/backend/src/backend/application/assessment/TelemetryDecisionService";
import type {PostgresRepository} from "../src/backend/src/backend/infrastructure/postgres/app/PostgresRepository";
import type {AuthService} from "../src/backend/src/backend/application/auth/AuthService";
import type {TelemetryService} from "../src/backend/src/backend/application/measurements/TelemetryService";
import {AppError,type Session} from "../src/backend/src/backend/domain/model";

const now=new Date("2026-11-15T01:00:00Z");
const session={sessionId:"session",astronautId:"astronaut",missionId:"mission",role:"astronauta"} as Session;
const fields={ecg:100,bpm_ecg:72,estado_ecg_x50:100,resp_mg:8,rpm:14,estado_resp_x50:100,spo2:98,bpm_oxi:73,estado_oxi_x50:200,ir:55000,rojo:24000};
function fixture(options:{assignment?:boolean;disconnected?:boolean;deny?:boolean}={}) {
 const calls:URLSearchParams[]=[];
 const repo={
  atomic:async <T>(work:()=>Promise<T>)=>work(),
  devices:async()=>[{id:"device",signal:options.disconnected?{status:"disconnected",observedAt:now.toISOString()}:null}],
  db:{prepare:(sql:string)=>({get:async()=>sql.includes("FROM environment_profiles")
    ? {definition:JSON.stringify({id:"mars_surface",label:"Marte histórico"})}
    : options.assignment===false?undefined:{effective_from:"2026-11-15T00:59:00.000Z",effective_to:null,scenario_id:"mars_surface",revision:"historical-revision"}})},
 } as unknown as PostgresRepository;
 const auth={requireSession:async(id:string,role:string)=>{assert.equal(id,session.sessionId);assert.equal(role,"astronauta");if(options.deny)throw new AppError(403,"FORBIDDEN","denied");return session;}} as unknown as AuthService;
 const telemetry={history:async(owner:Session,params:URLSearchParams)=>{assert.equal(owner,session);calls.push(params);return {samples:[{deviceId:"device",readingId:"one",capturedAt:"2026-11-15T00:59:59.000Z",fields}]};}} as unknown as TelemetryService;
 return {service:new TelemetryDecisionService(repo,auth,telemetry),calls};
}
test("DSS consulta el intervalo asignado y expone procedencia sin asumir catálogo actual",async()=>{
 const {service,calls}=fixture();const result=await service.evaluate(session,now);
 assert.equal(calls[0].get("from"),"2026-11-15T00:59:00.000Z");
 assert.equal(calls[0].get("to"),now.toISOString());assert.equal(calls[0].get("limit"),"100");
 assert.equal(result.assignment.reference.revision,"historical-revision");
 assert.equal(result.scenario.label,"Marte histórico");assert.equal(result.radiationProvenance.status,"supplied_not_reproduced");
 assert.equal(result.rules.freshnessSeconds,30);
});
test("DSS sin asignación devuelve conflicto y no consulta telemetría de ISS por defecto",async()=>{
 const {service,calls}=fixture({assignment:false});
 await assert.rejects(service.evaluate(session,now),{code:"ENVIRONMENT_MISSING"});assert.equal(calls.length,0);
});
test("DSS exige rol autorizado antes de consultar datos",async()=>{
 const {service,calls}=fixture({deny:true});
 await assert.rejects(service.evaluate(session,now),{code:"FORBIDDEN"});assert.equal(calls.length,0);
});
test("desconexión posterior invalida el resultado sin modificar campos crudos originales",async()=>{
 const {service}=fixture({disconnected:true});const result=await service.evaluate(session,now);
 assert.equal(result.state.level,"sensor_issue");assert.ok(result.telemetry.indicators.every(metric=>metric.value===null));
 assert.equal(fields.estado_ecg_x50,100);assert.equal(fields.estado_oxi_x50,200);
});
