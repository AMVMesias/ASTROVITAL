import assert from "node:assert/strict";
import {test} from "node:test";
import {BleFrames,decodeCsv} from "../src/frontend/src/frontend/features/capture/protocol";
const line="100,72,100,20,14,100,98,73,200,55000,24000",stamp="2026-11-14T12:00:00.000Z";
test("BLE reconstructs arbitrary notification fragments and multiple lines",()=>{
 const b=new BleFrames(),data=new TextEncoder().encode(line+"\r\n"+line+"\n");let lines:string[]=[];
 for(let i=0;i<data.length;i+=7)lines=lines.concat(b.feed(data.slice(i,i+7)));
 assert.deepEqual(lines,[line,line]);
});
test("explicit duplicate pairs are removed and mismatches reset framing",()=>{
 const b=new BleFrames(2),bytes=new TextEncoder().encode(line+"\n");assert.deepEqual(b.feed(bytes),[]);assert.deepEqual(b.feed(bytes),[line]);
 b.feed(new Uint8Array([1]));assert.throws(()=>b.feed(new Uint8Array([2])));assert.deepEqual(b.feed(bytes),[]);assert.deepEqual(b.feed(bytes),[line]);
});
test("malformed bytes and oversized packets are rejected",()=>{
 const b=new BleFrames();assert.throws(()=>b.feed(new Uint8Array(16385)));assert.throws(()=>b.feed(new Uint8Array([255,10])));
 assert.deepEqual(b.feed(new TextEncoder().encode(line+"\n")),[line]);
});
test("CSV-11 preserves every field and creates a valid pulse payload",()=>{
 const p=decodeCsv(line,"boot:1",stamp,"exercise");assert.equal(Object.keys(p.telemetry!.fields).length,11);
 assert.equal(p.telemetry!.fields.rojo,24000);assert.equal(p.telemetry!.readingId,"boot:1:telemetry");
 assert.deepEqual(p.measurement,{readingId:"boot:1",indicator:"heart_rate",value:72,unit:"bpm",capturedAt:stamp,activity:"exercise",note:"AD8232; clock=host_received_csv_snapshot"});assert.equal(p.signal,undefined);
});
test("no contact, no signal and insufficient BPM persist raw telemetry without a valid pulse",()=>{
 for(const [state,bpm,status]of [[0,0,"no_contact"],[50,0,"no_signal"],[100,0,"insufficient"]] as const){
 const values=line.split(",");values[1]=String(bpm);values[2]=String(state);const p=decodeCsv(values.join(","),"b:1",stamp,"rest");
 assert.ok(p.telemetry);assert.equal(p.measurement,undefined);assert.deepEqual(p.signal,{status,observedAt:stamp});}
});
test("CSV rejects wrong counts, empty fields, non-finite values and unknown states",()=>{
 for(const invalid of [line+",1",line.replace("100,72",",72"),line.replace("100,72","NaN,72"),line.replace("100,72","Infinity,72"),line.replace("72,100","72,75"),line.replace("100,72","100,301")])assert.throws(()=>decodeCsv(invalid,"b:1",stamp,"rest"));
});
