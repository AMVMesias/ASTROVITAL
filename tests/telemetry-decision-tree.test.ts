import assert from "node:assert/strict";
import {test} from "node:test";
import {analyzeTelemetry,type TelemetrySample} from "../src/backend/src/backend/application/assessment/telemetryDecisionTree";
const time=new Date("2026-11-15T01:00:00Z");
const f={ecg:100,bpm_ecg:76,estado_ecg_x50:100,resp_mg:8,rpm:17,estado_resp_x50:100,spo2:98,bpm_oxi:76,estado_oxi_x50:200,ir:60000,rojo:50000};
function s(i:number,edit:Record<string,number>={},at=i*15000):TelemetrySample{return {readingId:String(i),capturedAt:new Date(time.getTime()-at).toISOString(),fields:{...f,...edit}};}
const run=(samples:TelemetrySample[],other:Record<string,unknown>={})=>analyzeTelemetry({samples,now:time,scenarioId:"mars_surface",scenarioLabel:"Marte",scenarioScope:"exterior",radiation:null,...other});
test("no interpreta cero o estado inválido como hipoxia",()=>{const r=run([s(1,{spo2:0,estado_oxi_x50:50})]);assert.equal(r.state.level,"sensor_issue");assert.equal(r.telemetry.indicators[0].value,null);});
test("detecta lectura de oxígeno marcadamente baja",()=>{const r=run([s(1,{spo2:88}),s(2,{spo2:87}),s(3,{spo2:86})]);assert.equal(r.state.level,"priority");assert.ok(r.state.evidence.some(x=>x.includes("Tres instantáneas")));});
test("datos desactualizados no activan advertencia de oxígeno actual",()=>{const r=run([s(1,{spo2:86},300000)]);assert.equal(r.state.level,"insufficient");});
test("separación de escenario por fecha de selección",()=>{const r=run([s(1,{spo2:86}),s(2,{spo2:87})],{scenarioStartedAt:new Date(time.getTime()-1000).toISOString()});assert.equal(r.state.level,"no_data");});
test("cambio de pulso y discrepancia generan revisión",()=>{const r=run([s(1,{bpm_ecg:110,bpm_oxi:70}),s(2,{bpm_ecg:108}),s(3),s(4),s(5)]);assert.equal(r.state.level,"review");});
test("radiación histórica no cambia estado fisiológico",()=>{const samples=[s(1),s(2),s(3)];const a=run(samples,{radiation:{mission:'LRO',instrument:'CRaTER',location:'órbita',n:70000,unit:'µGy/h',median:13,interpretation:'referencia'}});const b=run(samples);assert.equal(a.state.level,b.state.level);});

test("rechaza fechas futuras e indicadores antiguos aunque el firmware declare validez",()=>{
 const future=run([s(1,{spo2:80},-1000)]);
 assert.equal(future.state.level,"no_data");
 const stale=run([s(1,{spo2:80},31000)]);
 assert.equal(stale.state.level,"insufficient");
 assert.ok(stale.telemetry.indicators.every(i=>i.value===null&&i.quality==="stale"));
});
test("no infla tendencias con IDs repetidos ni mezcla dispositivos",()=>{
 const repeated=s(1,{bpm_ecg:110});
 const r=run([repeated,repeated,repeated]);
 assert.equal(r.telemetry.count,1);
 assert.ok(!r.state.evidence.some(e=>e.includes("Cambio observado")));
 const first={...s(1),deviceId:"one"},foreign={...s(2,{bpm_ecg:190}),deviceId:"two"};
 assert.equal(run([first,foreign]).telemetry.count,1);
});
test("la pérdida de señal actual no hereda una alerta de tendencia de pulso antigua",()=>{
 const samples=[s(0,{bpm_ecg:0,estado_ecg_x50:0}),s(1,{bpm_ecg:110}),s(2,{bpm_ecg:110}),s(3),s(4),s(5)];
 const r=run(samples);
 assert.ok(!r.state.evidence.some(e=>e.includes("Cambio observado")));
 assert.equal(r.telemetry.indicators.find(i=>i.key==="bpm_ecg")?.value,null);
});
test("no mezcla lecturas del intervalo anterior al regresar al mismo escenario",()=>{
 const r=run([s(1),s(2),s(3)],{scenarioStartedAt:new Date(time.getTime()-20000).toISOString()});
 assert.equal(r.telemetry.count,1);
 assert.equal(r.state.level,"insufficient");
});
test("valida reloj y vigencia configurados",()=>{
 assert.throws(()=>run([],{now:new Date(NaN)}));
 assert.throws(()=>run([],{maxAgeMs:0}));
 assert.throws(()=>run([],{scenarioStartedAt:"invalid"}));
});

test("metadatos de alerta identifican solo indicadores vigentes que activaron reglas",()=>{
 const low=run([s(1,{spo2:88})]);
 assert.equal(low.telemetry.indicators.find(i=>i.key==="spo2")?.alertLevel,"priority");
 assert.equal(low.telemetry.indicators.find(i=>i.key==="rpm")?.alertLevel,null);
 assert.equal(run([s(1,{spo2:93})]).telemetry.indicators[0].alertLevel,"review");
 assert.equal(run([s(1,{spo2:88},31000)]).telemetry.indicators[0].alertLevel,null);
 assert.equal(run([s(1,{spo2:0,estado_oxi_x50:50})]).telemetry.indicators[0].alertLevel,null);
});
