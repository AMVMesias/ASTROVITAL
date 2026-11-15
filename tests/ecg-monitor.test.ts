import assert from "node:assert/strict";
import {test} from "node:test";
import {EcgStream,ecgSegments} from "../src/frontend/src/frontend/features/capture/ecgStream";
import {sensorHasAlert,type SensorDecision,type SensorSnapshot} from "../src/frontend/src/frontend/features/dashboard/readingPresentation";

test("monitor conserva muestras BLE previas al muestreo de 1 Hz y reinicia al reconectar",()=>{
 const stream=new EcgStream();stream.setConnected(true);
 for(let index=0;index<25;index++)stream.append(index-12,100,1000+index*40);
 stream.setConnected(false);
 assert.equal(stream.getSnapshot().points.length,25);
 assert.equal(stream.getSnapshot().connected,false);
 stream.setConnected(true);assert.equal(stream.getSnapshot().points.length,0);
 stream.setConnected(false);
});
test("buffer ECG acotado descarta valores no finitos, tiempo regresivo y datos sin conexión",()=>{
 const stream=new EcgStream();stream.append(10,100,0);assert.equal(stream.getSnapshot().points.length,0);
 stream.setConnected(true);
 for(let index=0;index<4000;index++)stream.append(index,100,1000+index);
 stream.append(NaN,100,5000);stream.append(1,100,100);stream.setConnected(false);
 assert.equal(stream.getSnapshot().points.length,3000);
 assert.equal(stream.getSnapshot().points.at(-1)?.value,3999);
 stream.setConnected(true);stream.append(1,100,0);stream.append(2,100,11000);stream.setConnected(false);
 assert.equal(stream.getSnapshot().points.length,1);
});
test("trazo ECG no une pérdida de contacto, cortes largos ni muestras futuras",()=>{
 const segments=ecgSegments([{time:1000,value:1,contact:true},{time:1040,value:2,contact:true},
  {time:1080,value:0,contact:false},{time:1120,value:3,contact:true},
  {time:2000,value:4,contact:true},{time:3000,value:5,contact:true}],2200);
 assert.deepEqual(segments.map(segment=>segment.map(point=>point.value)),[[1,2],[3],[4]]);
});
test("rojo requiere alerta del backend para la misma instantánea vigente",()=>{
 const now=100000,capturedAt=new Date(now-1000).toISOString();
 const snapshot:SensorSnapshot={deviceId:"one",readingId:"r1",capturedAt,maxAgeSeconds:30,sensors:{oximeter:{spo2:88},respiration:{rpm:14}}};
 const decision:SensorDecision={timestamp:new Date(now).toISOString(),telemetry:{latestAt:capturedAt,lastReadingId:"r1",deviceId:"one",indicators:[{key:"spo2",value:88,quality:"valid",alertLevel:"priority"}]}};
 assert.equal(sensorHasAlert(snapshot,decision,"spo2",now),true);
 assert.equal(sensorHasAlert(snapshot,decision,"rpm",now),false);
 assert.equal(sensorHasAlert(snapshot,decision,"spo2",now+31000),false);
 assert.equal(sensorHasAlert({...snapshot,deviceId:"two"},decision,"spo2",now),false);
 assert.equal(sensorHasAlert({...snapshot,readingId:"other"},decision,"spo2",now),false);
 assert.equal(sensorHasAlert(snapshot,{...decision,telemetry:{...decision.telemetry,indicators:[{key:"spo2",value:null,quality:"unavailable",alertLevel:"priority"}]}},"spo2",now),false);
});
