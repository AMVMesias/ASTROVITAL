export type EcgPoint = {time:number;value:number;contact:boolean};
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
  append(value:number,state:number,time:number) {
    if(!this.connected||!Number.isFinite(value)||!Number.isFinite(time)||![0,50,100].includes(state))return;
    const previous=this.points.at(-1);
    if(previous&&time<previous.time)return;
    this.points=this.points.filter(point=>point.time>=time-10000).slice(-2999);
    this.points.push({time,value,contact:state!==0});
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
