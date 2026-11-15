import assert from "node:assert/strict";
import {test} from "node:test";
import {analyzeMissionContext,validateMissionContext,CONTEXT_TTL_MS,type MissionContext} from "../src/backend/src/backend/application/assessment/missionContext";
import {analyzeTelemetry} from "../src/backend/src/backend/application/assessment/telemetryDecisionTree";

const now=new Date("2026-11-15T01:00:00Z"),assignmentFrom="2026-11-15T00:50:00.000Z";
const fields={ecg:100,bpm_ecg:90,estado_ecg_x50:100,resp_mg:8,rpm:14,estado_resp_x50:100,spo2:98,bpm_oxi:90,estado_oxi_x50:200,ir:55000,rojo:24000};
const telemetry=(edit:Record<string,number>={},offset=1000,scenarioId="moon_surface")=>analyzeTelemetry({samples:[{readingId:"same-snapshot",capturedAt:new Date(now.getTime()-offset).toISOString(),fields:{...fields,...edit}}],now,scenarioId,scenarioLabel:scenarioId,scenarioScope:"exterior",radiation:null});
const base:MissionContext={scenarioId:"moon_surface",assignmentFrom,capturedAt:now.toISOString(),sourceNote:"Synthetic test fixture",origin:"simulated",location:"cabin",activity:"exercise",phase:"surface",pressureKpa:101.325,oxygenPercent:21,co2Mmhg:1,co2WindowMinutes:60,measuredHrMax:180};
const run=(edit:Partial<MissionContext>={},sensor=telemetry(),at=now)=>analyzeMissionContext({...base,...edit},sensor,assignmentFrom,at);

test("same personal readings distinguish lower interior oxygen pressure and elevated CO2",()=>{
 const sensor=telemetry(),before=structuredClone(sensor);
 const nominal=run({},sensor),low=run({pressureKpa:56.5},sensor),co2=run({co2Mmhg:5},sensor);
 assert.equal(nominal.environment.pio2Mmhg,149.7);assert.equal(nominal.environment.status,"within_reference");
 assert.equal(low.environment.pio2Mmhg,79.1);assert.equal(low.environment.status,"review");
 assert.ok(low.findings.some(f=>f.code==="oxygen_below_reference"&&f.level==="review"));
 assert.equal(co2.environment.pio2Mmhg,149.7);assert.equal(co2.environment.status,"review");
 assert.ok(co2.findings.some(f=>f.code==="co2_average"&&f.level==="review"));
 assert.deepEqual(sensor,before); // Environment cannot rewrite physiology or its warnings.
 assert.equal(nominal.personal.hrPercentMax,50);
});
test("changing planet alone produces identical environmental and intensity calculations",()=>{
 const lunar=run(),martian=run({scenarioId:"mars_surface"},telemetry({},1000,"mars_surface"));
 assert.deepEqual(lunar.environment,martian.environment);assert.deepEqual(lunar.personal,martian.personal);
});
test("oxygen-enriched low-pressure suit is not incorrectly labelled hypoxic from pressure alone",()=>{
 const result=run({location:"suit",pressureKpa:29.6475,oxygenPercent:100,co2Mmhg:null});
 assert.ok(Math.abs(result.environment.pio2Mmhg!-175.4)<0.2);
 assert.ok(!result.findings.some(f=>f.code==="oxygen_below_reference"));
 assert.equal(result.environment.status,"incomplete");
});
test("CO2 window and suit protocols are respected instead of applying cabin average to all inputs",()=>{
 assert.equal(run({co2WindowMinutes:0}).environment.status,"incomplete");
 assert.equal(run({co2WindowMinutes:0,co2Mmhg:5}).environment.status,"review");
 for(const co2Mmhg of [1,5]){
  const result=run({location:"suit",co2Mmhg});
  assert.equal(result.environment.status,"incomplete");
  assert.ok(result.findings.some(f=>f.code==="co2_suit_protocol"));
  assert.ok(!result.findings.some(f=>f.code==="co2_average"));
 }
 assert.equal(run({co2Mmhg:3}).environment.status,"within_reference");
 assert.equal(run({co2Mmhg:3.01}).environment.status,"review");
});
test("missing measurements, expiry, future dates and changed assignment cannot yield a current conclusion",()=>{
 const missing=run({pressureKpa:null,oxygenPercent:null,co2Mmhg:null});
 assert.equal(missing.environment.pio2Mmhg,null);assert.equal(missing.environment.status,"incomplete");
 assert.equal(run({},telemetry(),new Date(now.getTime()+CONTEXT_TTL_MS+1)).status,"stale");
 assert.equal(run({capturedAt:new Date(now.getTime()+1).toISOString()}).status,"stale");
 assert.equal(run({assignmentFrom:"2026-11-15T00:55:00.000Z"}).status,"missing");
 assert.equal(run({scenarioId:"mars_surface"}).status,"missing");
 assert.equal(analyzeMissionContext(null,telemetry(),assignmentFrom,now).status,"missing");
});
test("individual measured maximum and activity change intensity, invalid or stale ECG cannot provide it",()=>{
 assert.equal(run({measuredHrMax:150}).personal.hrPercentMax,60);
 assert.equal(run({activity:"rest"}).personal.hrPercentMax,null);
 assert.equal(run({activity:"unknown"}).personal.hrPercentMax,null);
 assert.equal(run({measuredHrMax:null}).personal.hrPercentMax,null);
 assert.equal(run({},telemetry({estado_ecg_x50:0})).personal.hrPercentMax,null);
 assert.equal(run({},telemetry({},31000)).personal.hrPercentMax,null);
 const over=run({measuredHrMax:80});assert.equal(over.personal.hrPercentMax,112.5);
 assert.ok(over.findings.some(f=>f.code==="hr_ratio"&&f.level==="review"));
});
test("normal environment never downgrades a low SpO2 physiological priority",()=>{
 const sensor=telemetry({spo2:88}),before=structuredClone(sensor.state);
 assert.equal(sensor.state.level,"priority");assert.equal(run({},sensor).environment.status,"within_reference");
 assert.deepEqual(sensor.state,before);
});
test("oxygen thresholds use unrounded results and preserve exposure qualifications",()=>{
 const pressure=(pio2:number)=>(pio2/.21+47)/7.50061683;
 assert.equal(run({pressureKpa:pressure(126.99)}).findings[0].code,"oxygen_below_reference");
 assert.equal(run({pressureKpa:pressure(127.01)}).findings[0].code,"oxygen_monitoring");
 assert.equal(run({pressureKpa:pressure(144.99)}).findings[0].code,"oxygen_monitoring");
 assert.equal(run({pressureKpa:pressure(145.01)}).environment.status,"within_reference");
 assert.equal(run({oxygenPercent:100,pressureKpa:(356.01+47)/7.50061683}).findings[0].code,"oxygen_exposure_protocol");
});
test("context rejects malformed fields, unknown owner injection, missing units, invalid dates and impossible partial pressure",()=>{
 assert.deepEqual(validateMissionContext(base,now),base);
 const invalid=[{astronautId:"other"},{pressureKpa:"101.325"},{pressureKpa:undefined},{pressureKpa:0},{oxygenPercent:101},{co2Mmhg:-1},{measuredHrMax:0},{co2WindowMinutes:1},{location:"planet"},{origin:"sensor"},{activity:"moon"},{capturedAt:"2026-02-30T00:00:00Z"},{capturedAt:"2026-11-15T01:00:01Z"},{capturedAt:"2026-11-15T00:49:59Z"},{sourceNote:" "},{pressureKpa:6.3,co2Mmhg:100}];
 for(const edit of invalid)assert.throws(()=>validateMissionContext({...base,...edit},now),{code:"VALIDATION"},JSON.stringify(edit));
});
