export type Notice={
 id:string; status:"open"|"tracking"|"closed";reason:"invalid"|"stale"|"deviation";createdAt?:string;
 evidence:{ruleVersion:string;direction?:"above"|"below";reference?:{mean:number;count:number};evidence?:string[];recommendation?:{message:{es:string;en:string}}};
 reading?:{indicator:"heart_rate"|"sleep"|"wellbeing";value:number;unit:string;capturedAt:string;activity?:string;origin:string;environment?:{scenarioId:string;profileVersion:string}};
};
/** Presentation groups only: retain every saved alert and its independent follow-up. */
export function groupNotices(alerts:Notice[]):Notice[][]{
 const groups=new Map<string,Notice[]>();
 for(const alert of alerts){const r=alert.reading;
  const key=!r||alert.status==="closed" ? alert.id : JSON.stringify([alert.reason,alert.evidence.ruleVersion,alert.evidence.direction,r.indicator,r.activity,r.origin,r.environment?.scenarioId,r.environment?.profileVersion,(r.capturedAt).slice(0,10)]);
  const group=groups.get(key)??[];group.push(alert);groups.set(key,group);
 }
 return [...groups.values()].map(group=>group.sort((a,b)=>(b.reading?.capturedAt??b.createdAt??"").localeCompare(a.reading?.capturedAt??a.createdAt??"")));
}
export function noticeTitle(alert:Notice,es:boolean){
 const name=alert.reading?.indicator==="heart_rate" ? (alert.reading.activity==="rest" ? (es?"Pulso en reposo":"Resting pulse") : (es?"Pulso":"Pulse")) : alert.reading?.indicator==="sleep" ? (es?"Sueño":"Sleep") : alert.reading?.indicator==="wellbeing" ? (es?"Bienestar":"Wellbeing") : (es?"Medición":"Measurement");
 if(alert.reason==="invalid")return es?"Revisar la calidad de la lectura":"Review reading quality";
 if(alert.reason==="stale")return es?"Se necesita una lectura nueva":"A new reading is needed";
 return `${name}: ${alert.evidence.direction==="above" ? (es?"por encima":"above") : alert.evidence.direction==="below" ? (es?"por debajo":"below") : (es?"variación":"variation")} ${es?"de tu referencia":"your baseline"}`;
}
