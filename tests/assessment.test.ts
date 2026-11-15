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
