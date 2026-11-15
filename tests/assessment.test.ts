import assert from "node:assert/strict";
import { test } from "node:test";
import { assessMeasurements, type PersonalMeasurement } from "../src/backend/src/backend/application/assessment/assessMeasurements";
const rule={version:"test-1",referenceWindowMs:86400000,maxAgeMs:60000,minimumSamples:3,consecutiveSamples:2,absoluteDeviation:10};
const now=new Date("2026-11-14T12:00:00.000Z");
function reading(id:string,value:number,seconds=0):PersonalMeasurement{return {id,value,capturedAt:new Date(now.getTime()-seconds*1000).toISOString(),astronautId:"a",missionId:"m",indicator:"heart_rate",unit:"bpm",quality:"valid",origin:"sensor",activity:"rest",environment:{scenarioId:"iss_leo",revision:"r1"}};}
const baseline=[reading("1",70,50),reading("2",70,40),reading("3",70,30)];
test("assessment distinguishes invalid, stale and insufficient readings",()=>{
 assert.equal(assessMeasurements({...reading("x",70),quality:"invalid"},[],rule,now).status,"invalid");
 assert.equal(assessMeasurements(reading("x",70,61),[],rule,now).status,"stale");
 assert.equal(assessMeasurements(reading("x",70),baseline,rule,now).status,"insufficient");
});
test("assessment requires sustained deviations against a separate baseline",()=>{
 assert.equal(assessMeasurements(reading("x",90),[...baseline,reading("4",90,10)],rule,now).status,"deviation");
 assert.equal(assessMeasurements(reading("x",90),[...baseline,reading("4",70,10)],rule,now).status,"stable");
});
test("assessment isolates people, environments, duplicate IDs and simulated origins",()=>{
 const foreign=baseline.map(r=>({...r,astronautId:"other"}));
 assert.equal(assessMeasurements(reading("x",90),[...foreign,reading("4",90,10)],rule,now).status,"insufficient");
 assert.equal(assessMeasurements(reading("x",90),[...baseline.map(r=>({...r,origin:"simulado" as const})),reading("4",90,10)],rule,now).status,"insufficient");
 assert.equal(assessMeasurements(reading("x",90),[baseline[0],baseline[0],baseline[0],reading("4",90,10)],rule,now).status,"insufficient");
});
test("contextual recommendations remain available after the PostgreSQL migration",()=>{
 const result=assessMeasurements(reading("x",90),[...baseline,reading("4",90,10)],rule,now);
 assert.equal(result.direction,"above");
 assert.equal(result.recommendation?.id,"pulse-rest");
 assert.ok(result.recommendation?.message.es);
 assert.ok(result.recommendation?.message.en);
 assert.equal(assessMeasurements({...reading("x",70),quality:"invalid"},[],rule,now).recommendation?.action,"repeat_reading");
 assert.equal(assessMeasurements(reading("x",70),[],rule,now).recommendation?.action,"collect_history");
});

test("resting heart baseline excludes exercise, EVA, unknown, invalid and out-of-window history", () => {
 const good = [...baseline, reading("recent", 70, 10)];
 const noise = [
  ...(["exercise", "eva", "unknown", undefined] as const).flatMap((activity, i) => baseline.map(r => ({...r,id:`noise-${i}-${r.id}`,activity,value:200}))),
  ...baseline.map(r=>({...r,id:`invalid-${r.id}`,quality:"invalid" as const,value:200})),
  ...baseline.map(r=>({...r,id:`old-${r.id}`,capturedAt:new Date(now.getTime()-rule.referenceWindowMs-1000).toISOString(),value:200})),
  ...baseline.map(r=>({...r,id:`foreign-${r.id}`,astronautId:"someone-else",value:200})),
 ];
 const result=assessMeasurements(reading("current",70),[...good,...noise],rule,now);
 assert.equal(result.status,"stable"); assert.equal(result.reference?.mean,70); assert.equal(result.reference?.count,3);
 for (const activity of ["exercise","eva","unknown",undefined] as const) {
   const current={...reading("current",72),activity};
   const assessed=assessMeasurements(current,good,rule,now);
   assert.equal(assessed.status,"insufficient"); assert.equal(assessed.reference?.mean,70);
   assert.equal(assessed.direction,undefined);
   assert.equal(assessMeasurements(current,noise,rule,now).reference,undefined);
 }
});
test("reference requires minimum valid rest samples; invalid/stale current readings cannot be stable",()=>{
 assert.equal(assessMeasurements(reading("current",70),baseline.slice(0,2),rule,now).reference,undefined);
 assert.equal(assessMeasurements(reading("current",70),baseline,rule,now).reference?.count,3);
 assert.equal(assessMeasurements({...reading("current",70),quality:"invalid"},baseline,rule,now).status,"invalid");
 assert.equal(assessMeasurements(reading("current",70,61),baseline,rule,now).status,"stale");
 const unknown = baseline.map(r=>({...r,activity:undefined}));
 assert.equal(assessMeasurements({...reading("current",70),activity:undefined},unknown,rule,now).reference,undefined);
});
test("sleep and wellbeing retain their existing same-activity evaluation",()=>{
 for(const indicator of ["sleep","wellbeing"]) {
  const current={...reading("current",90),indicator,activity:undefined};
  const history=[...baseline,reading("recent",90,10)].map(r=>({...r,indicator,activity:undefined}));
  assert.equal(assessMeasurements(current,history,rule,now).status,"deviation");
 }
});
