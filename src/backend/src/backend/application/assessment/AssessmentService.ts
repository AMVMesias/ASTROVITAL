import type { Measurement, Indicator } from "../../domain/model";
import type { PostgresRepository } from "../../infrastructure/postgres/app/PostgresRepository";
import { createPostgresAlertRepository } from "../../infrastructure/postgres/app/alertRepository";
import { assessMeasurements, type AssessmentRule, type PersonalMeasurement } from "./assessMeasurements";
import { evaluatePersistedMeasurement } from "./evaluatePersistedMeasurement";

const day=86400_000;
/** Parámetros demostrativos versionados; no validados clínicamente. */
export const demoRules: Record<Indicator,AssessmentRule> = {
  sleep:{version:"demo-sleep-1",referenceWindowMs:14*day,maxAgeMs:2*day,minimumSamples:5,consecutiveSamples:3,absoluteDeviation:1.5},
  wellbeing:{version:"demo-wellbeing-1",referenceWindowMs:14*day,maxAgeMs:2*day,minimumSamples:5,consecutiveSamples:3,absoluteDeviation:1},
  heart_rate:{version:"demo-heart-rate-1",referenceWindowMs:14*day,maxAgeMs:30_000,minimumSamples:5,consecutiveSamples:3,absoluteDeviation:15},
};
export function personal(measurement:Measurement):PersonalMeasurement {
  return {...measurement,origin:measurement.origin==="simulated"?"simulado":measurement.origin==="device"?"sensor":"manual",
    environment:{scenarioId:measurement.environment.scenarioId,revision:measurement.environment.profileVersion}};
}
export class AssessmentService {
  constructor(private repo:PostgresRepository) {}
  private async history(value:Measurement) {
    const from=new Date(Date.parse(value.capturedAt)-demoRules[value.indicator].referenceWindowMs).toISOString();
    return (await (await this.repo.all("SELECT payload FROM measurements WHERE astronaut_id=? AND indicator=? AND captured_at>=? AND captured_at<? ORDER BY captured_at,id",value.astronautId,value.indicator,from,value.capturedAt))
      .map(row=>personal(JSON.parse(String(row.payload)) as Measurement)));
  }
  async preview(value:Measurement,now=new Date()) {
    return assessMeasurements(personal(value),(await this.history(value)),demoRules[value.indicator],now);
  }
  async process(id:string) {
    const job=(await this.repo.get("SELECT j.status,m.payload FROM assessment_jobs j JOIN measurements m ON m.id=j.id WHERE j.id=?",id));
    if(!job || job.status==="done") return {status:"done"};
    (await this.repo.run("UPDATE assessment_jobs SET attempts=attempts+1 WHERE id=?",id));
    try {
      const value=JSON.parse(String(job.payload)) as Measurement;
      const result=await evaluatePersistedMeasurement({list:async()=>(await this.history(value))},createPostgresAlertRepository(this.repo.db),personal(value),demoRules[value.indicator],new Date());
      (await this.repo.run("UPDATE assessment_jobs SET status='done',error=NULL,rule_version=?,result=? WHERE id=?",demoRules[value.indicator].version,JSON.stringify(result.assessment),id));
      return {status:"done",assessment:result.assessment};
    } catch {
      (await this.repo.run("UPDATE assessment_jobs SET error='ASSESSMENT_FAILED' WHERE id=?",id));
      return {status:"pending",code:"ASSESSMENT_FAILED"};
    }
  }
  async retry(limit=100) {
    const jobs=(await this.repo.all("SELECT id FROM assessment_jobs WHERE status='pending' ORDER BY id LIMIT ?",limit));
    for(const row of jobs) await this.process(String(row.id));
    return {processed:jobs.length,pending:Number((await this.repo.get("SELECT COUNT(*) AS n FROM assessment_jobs WHERE status='pending'"))?.n??0)};
  }
}
