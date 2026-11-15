export type EcgPoint = {time:number;value:number;contact:boolean;state?:number;bpm?:number};
export type EcgSnapshot = {connected:boolean;points:readonly EcgPoint[]};
export const EMPTY_ECG:EcgSnapshot={connected:false,points:[]};

/** Live reception only: samples are never interpolated or posted at waveform rate. */
export class EcgStream {
  private snapshot:EcgSnapshot=EMPTY_ECG;
  private points:EcgPoint[]=[];
  private connected=false;
  private listeners=new Set<()=>void>();
  private timer:ReturnType<typeof setTimeout>|undefined;
  readonly subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  readonly getSnapshot=()=>this.snapshot;
  readonly getServerSnapshot=()=>EMPTY_ECG;
  setConnected(value:boolean) {
    if(value&&!this.connected)this.points=[];
    this.connected=value;
    this.publish();
  }
  append(value:number,state:number,time:number,bpm?:number) {
    if(!this.connected||!Number.isFinite(value)||!Number.isFinite(time)||![0,50,100].includes(state))return;
    const previous=this.points.at(-1);
    if(previous&&time<previous.time)return;
    this.points=this.points.filter(point=>point.time>=time-10000).slice(-2999);
    this.points.push({time,value,contact:state!==0,state,bpm});
    if(!this.timer)this.timer=setTimeout(()=>this.publish(),100);
  }
  private publish() {
    clearTimeout(this.timer);this.timer=undefined;
    this.snapshot={connected:this.connected,points:this.points.slice()};
    for(const listener of this.listeners)listener();
  }
}

/** Gap-aware segments; no line connects samples across missing contact or a long gap. */
export function ecgSegments(points:readonly EcgPoint[],now:number):EcgPoint[][] {
  const segments:EcgPoint[][]=[];let current:EcgPoint[]=[];
  for(const point of points) {
    if(point.time<now-10000||point.time>now)continue;
    if(!point.contact){if(current.length)segments.push(current);current=[];continue;}
    if(current.length&&point.time-current.at(-1)!.time>500){segments.push(current);current=[];}
    current.push(point);
  }
  if(current.length)segments.push(current);
  return segments;
}

export function hasValidatedPulse(point:EcgPoint|undefined):boolean {
 const bpm=point?.bpm;
 return !!point&&point.contact&&point.state===100&&typeof bpm==="number"&&Number.isFinite(bpm)&&bpm>0&&bpm<=300;
}

export function validatedEcgSegments(points:readonly EcgPoint[],now:number):EcgPoint[][] {
 return ecgSegments(points.map(point=>({...point,contact:hasValidatedPulse(point)})),now);
}

/** Display-only, time-aware DC rejection and mild low-pass; never used to derive BPM. */
export function filterEcg(points:readonly EcgPoint[]):EcgPoint[] {
 if(!points.length)return [];
 const intervals=points.slice(1).map((point,index)=>point.time-points[index].time).filter(dt=>dt>0&&dt<=500).sort((a,b)=>a-b);
 const interval=intervals[Math.floor(intervals.length/2)]??40;
 const cutoff=Math.min(8,(1000/interval)*.3);
 const highRc=1/(2*Math.PI*.5),lowRc=1/(2*Math.PI*cutoff);
 let input=points[0].value,high=0,low=0;
 return points.map((point,index)=>{
  if(index===0)return {...point,value:0};
  const dt=Math.min(500,Math.max(1,point.time-points[index-1].time||interval))/1000;
  const highAlpha=highRc/(highRc+dt),lowAlpha=dt/(lowRc+dt);
  high=highAlpha*(high+point.value-input);input=point.value;
  low+=lowAlpha*(high-low);
  return {...point,value:low};
 });
}
