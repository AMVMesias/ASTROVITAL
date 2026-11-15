import assert from "node:assert/strict";
import {test} from "node:test";
import {currentPulseStatus,readingFreshness,type Reading,type SensorSnapshot} from "../src/frontend/src/frontend/features/dashboard/readingPresentation";
const now=Date.now();
const reading:Reading={id:"heart",indicator:"heart_rate",value:138,unit:"bpm",capturedAt:new Date(now-5000).toISOString(),origin:"device",quality:"valid",deviceId:"device",maxAgeSeconds:30};
const snapshot:SensorSnapshot={deviceId:"device",capturedAt:new Date(now-1000).toISOString(),maxAgeSeconds:30,sensors:{ecg:{state:0,bpm:null},oximeter:{spo2:null},respiration:{rpm:null}}};
test("current pulse stops displaying a historical number after contact loss or disconnection",()=>{
 assert.equal(currentPulseStatus(reading,null,snapshot,now),"no_contact");
 assert.equal(currentPulseStatus(reading,{status:"disconnected",observedAt:snapshot.capturedAt},undefined,now),"disconnected");
 assert.equal(currentPulseStatus(reading,null,{...snapshot,sensors:{...snapshot.sensors,ecg:{state:1,bpm:null}}},now),"no_signal");
 assert.equal(currentPulseStatus(reading,null,{...snapshot,sensors:{...snapshot.sensors,ecg:{state:2,bpm:null}}},now),"insufficient");
 assert.equal(reading.value,138);
});
test("old signal cannot mask a newer valid pulse; stale and invalid readings never appear live",()=>{
 assert.equal(currentPulseStatus(reading,{status:"no_contact",observedAt:new Date(now-10000).toISOString()},undefined,now),"live");
 assert.equal(currentPulseStatus(reading,null,undefined,now+30000),"stale");
 assert.equal(currentPulseStatus({...reading,quality:"invalid"},null,undefined,now),"invalid");
 assert.equal(currentPulseStatus(undefined,null,snapshot,now),"no_contact");
 assert.equal(readingFreshness(snapshot,now+31000),"stale");
});
