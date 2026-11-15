import assert from "node:assert/strict";
import {test} from "node:test";
import {trendWindow} from "../src/frontend/src/frontend/features/dashboard/trendWindow";
const now=Date.parse("2026-11-15T08:00:00Z");
const series=(times:number[])=>[{points:times.map(time=>({time:new Date(time).toISOString(),value:80}))}];
test("Minutes of data use the chart width instead of a full-day axis",()=>{
 const result=trendWindow(series([now-200000,now]),now);
 assert.ok(result.span>=200000&&result.span<240000);
 assert.ok(200000/result.span>0.8);
});
test("Single-point and empty plots have a readable one-minute minimum",()=>{
 assert.equal(trendWindow([],now).span,60000);
 assert.equal(trendWindow(series([now-100000]),now).span,60000);
});
test("Future, invalid and older-than-24h samples do not stretch the plot",()=>{
 const samples=series([now-200000,now,now+3600000,now-90000000]);
 samples[0].points.push({time:"bad-date",value:80},{time:new Date(now-80000000).toISOString(),value:NaN});
 assert.ok(trendWindow(samples,now).span<240000);
 const fullDay=trendWindow(series([now-86400000,now]),now);assert.equal(fullDay.span,86400000);
});
