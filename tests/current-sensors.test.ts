import assert from "node:assert/strict";
import {test} from "node:test";
import {displayedPulse,currentPulseStatus,readingFreshness,type Reading,type SensorSnapshot} from "../src/frontend/src/frontend/features/dashboard/readingPresentation";
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

test("Retains a recent valid pulse during intermittent detection without promoting assessment",()=>{
 const intermittent={...snapshot,sensors:{...snapshot.sensors,ecg:{state:2,bpm:null}}};
 assert.equal(displayedPulse(reading,null,intermittent,now)?.value,reading.value);
 assert.equal(displayedPulse(reading,null,intermittent,now)?.retained,true);
 assert.equal(currentPulseStatus(reading,null,intermittent,now),"insufficient");
 assert.equal(displayedPulse(reading,null,intermittent,now+31000),null);
 assert.equal(displayedPulse(reading,null,snapshot,now),null);
 assert.equal(displayedPulse(reading,{status:"disconnected",observedAt:snapshot.capturedAt},undefined,now),null);
 assert.equal(displayedPulse({...reading,quality:"invalid"},null,intermittent,now),null);
 assert.equal(displayedPulse({...reading,capturedAt:new Date(now+1000).toISOString()},null,intermittent,now),null);
});
test("Shows firmware-valid telemetry before a persisted measurement arrives",()=>{
 const valid={...snapshot,sensors:{...snapshot.sensors,ecg:{state:2,bpm:179}}};
 assert.equal(displayedPulse(undefined,null,valid,now)?.value,179);
 assert.equal(displayedPulse(undefined,null,valid,now)?.retained,false);
 assert.equal(displayedPulse(undefined,null,valid,now+31000),null);
 assert.equal(displayedPulse(undefined,{status:"no_signal",observedAt:new Date(now).toISOString()},valid,now),null);
});
