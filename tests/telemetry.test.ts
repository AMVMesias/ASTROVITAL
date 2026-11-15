import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SqliteRepository} from '../src/backend/src/backend/infrastructure/sqlite/SqliteRepository';
import {seed,provisionDevice} from '../src/backend/src/backend/infrastructure/sqlite/seed';
import {createServices} from '../src/backend/src/backend/composition/local';
import {onboard} from './fixtures/auth';
import {telemetryFields} from '../src/backend/src/backend/application/measurements/TelemetryService';
import {AppError} from '../src/backend/src/backend/domain/model';

const password='telemetry-test-password-123', token='telemetry-test-device-token-00000000000001';
const fields={ecg:0,bpm_ecg:0,estado_ecg_x50:0,resp_mg:-1,rpm:0,estado_resp_x50:50,spo2:0,bpm_oxi:0,estado_oxi_x50:50,ir:1490,rojo:2316};
const code=(name:string)=>(error:unknown)=>error instanceof AppError&&error.code===name;
test('once campos persisten sin contacto; permisos, filtros, duplicados y valores disponibles',()=>{
 const repo=new SqliteRepository(':memory:');
 try {
  seed(repo,'admin',password);const app=createServices(repo);const admin=app.auth.session(app.auth.login({username:'admin',password}).token);
  const a=app.users.save(admin,{username:'telemetry-a',name:'A',role:'astronauta',password});
  const b=app.users.save(admin,{username:'telemetry-b',name:'B',role:'astronauta',password});
  onboard(app,a.username,password,password+'-new');onboard(app,b.username,password,password+'-new');
  const sa=app.auth.session(app.auth.login({username:a.username,password:password+'-new'}).token);
  const sb=app.auth.session(app.auth.login({username:b.username,password:password+'-new'}).token);
  provisionDevice(repo,a.username,'esp32-test',token);
  const input={readingId:'host:1',capturedAt:new Date(Date.now()-1000).toISOString(),fields};
  assert.throws(()=>app.telemetry.capture('esp32-test','wrong',input),code('DEVICE_UNAUTHORIZED'));
  assert.equal(app.telemetry.capture('esp32-test',token,input).duplicate,false);
  assert.equal(app.telemetry.capture('esp32-test',token,input).duplicate,true);
  assert.throws(()=>app.telemetry.capture('esp32-test',token,{...input,fields:{...fields,ir:2000}}),code('READING_CONFLICT'));
  const samples=app.telemetry.history(sa,new URLSearchParams()).samples;
  assert.equal(samples.length,1);assert.deepEqual(samples[0].fields,fields);
  assert.equal(samples[0].sensors.ecg.bpm,null);assert.equal(samples[0].sensors.oximeter.spo2,null);
  assert.equal(app.telemetry.history(sb,new URLSearchParams()).samples.length,0);
  assert.throws(()=>app.telemetry.history(admin,new URLSearchParams()),code('FORBIDDEN'));
  assert.deepEqual(app.telemetry.history(sa,new URLSearchParams('field=ir')).samples[0].fields,{ir:1490});
  assert.throws(()=>app.telemetry.history(sa,new URLSearchParams('field=unknown')),code('VALIDATION'));
  assert.throws(()=>app.telemetry.capture('esp32-test',token,{...input,readingId:'bad',fields:{...fields,ecg:null}}),code('VALIDATION'));
  const next={...input,readingId:'host:2',capturedAt:new Date().toISOString(),fields:{...fields,bpm_ecg:70,estado_ecg_x50:100,rpm:12,estado_resp_x50:100,spo2:98,bpm_oxi:72,estado_oxi_x50:200}};
  app.telemetry.capture('esp32-test',token,next);
  const latest=app.telemetry.history(sa,new URLSearchParams(),true).samples;
  assert.equal(latest.length,1);assert.equal(latest[0].sensors.ecg.bpm,70);assert.equal(latest[0].sensors.respiration.rpm,12);assert.equal(latest[0].sensors.oximeter.spo2,98);assert.equal(latest[0].sensors.oximeter.bpm,72);
  assert.deepEqual(Object.keys(latest[0].fields),[...telemetryFields]);
  assert.equal(repo.get('SELECT COUNT(*) AS n FROM measurements')?.n,0);
 } finally {repo.close();}
});
