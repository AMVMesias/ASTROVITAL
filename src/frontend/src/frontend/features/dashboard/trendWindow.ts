/** The query covers up to 24h; the plot fits the timestamps actually returned. */
export function trendWindow(series:readonly {points:readonly {time:string;value:number}[]}[],now:number){
 const times=series.flatMap(s=>s.points.filter(p=>Number.isFinite(p.value)).map(p=>Date.parse(p.time))).filter(time=>Number.isFinite(time)&&time>=now-86400000&&time<=now);
 if(!times.length)return {start:now-60000,end:now,span:60000};
 const first=Math.min(...times),last=Math.max(...times),padding=Math.max(1000,(last-first)*0.05);
 const end=Math.min(now,last+padding),start=Math.max(now-86400000,Math.min(first-padding,end-60000));
 return {start,end,span:end-start};
}
