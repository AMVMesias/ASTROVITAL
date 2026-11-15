import assert from "node:assert/strict";
import {test} from "node:test";
import {groupNotices,noticeTitle,type Notice} from "../src/frontend/src/frontend/features/alerts/presentation";
const alert:Notice={id:"first",reason:"deviation",status:"open",evidence:{ruleVersion:"test",direction:"above",reference:{mean:70,count:5}},reading:{indicator:"heart_rate",value:90,unit:"bpm",capturedAt:"2026-11-15T12:00:00.000Z",activity:"rest",origin:"device",environment:{scenarioId:"iss",profileVersion:"v1"}}};
test("similar notice display preserves original IDs, follow-up state and latest evidence",()=>{
 const second={...alert,id:"second",status:"tracking" as const,reading:{...alert.reading!,value:95,capturedAt:"2026-11-15T12:00:01.000Z"}};
 const grouped=groupNotices([alert,second]);assert.equal(grouped.length,1);assert.equal(grouped[0].length,2);assert.equal(grouped[0][0].reading?.value,95);
 assert.equal(grouped[0][1].id,"first");assert.equal(grouped[0][0].status,"tracking");assert.equal(alert.reading?.value,90);
 assert.match(noticeTitle(alert,true),/Pulso en reposo: por encima/);
});
test("grouping keeps different direction, indicator, simulation, environment, dates and closed records apart",()=>{
 for(const other of [
  {...alert,evidence:{...alert.evidence,direction:"below" as const}},
  {...alert,reading:{...alert.reading!,indicator:"sleep" as const}},
  {...alert,reading:{...alert.reading!,origin:"simulated"}},
  {...alert,reading:{...alert.reading!,environment:{scenarioId:"mars",profileVersion:"v1"}}},
  {...alert,reading:{...alert.reading!,capturedAt:"2026-11-16T12:00:00.000Z"}},
  {...alert,status:"closed" as const},
  {...alert,reading:undefined},
 ])assert.equal(groupNotices([alert,{...other,id:"other"}]).length,2);
});
