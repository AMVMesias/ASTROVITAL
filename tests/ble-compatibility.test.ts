import assert from "node:assert/strict";
import {test} from "node:test";
import {bluetoothUnavailableReason,bluetoothConnectionError,bluetoothStep} from "../src/frontend/src/frontend/features/capture/compatibility";
const supported={secure:true,apiAvailable:true,policyAllowed:true,linux:true};
test("BLE Linux disponible no se bloquea por el sistema operativo",()=>{
 assert.equal(bluetoothUnavailableReason(supported),"");
});
test("BLE diferencia origen inseguro, API Linux ausente y política bloqueada",()=>{
 assert.match(bluetoothUnavailableReason({...supported,secure:false}),/HTTPS/);
 assert.match(bluetoothUnavailableReason({...supported,apiAvailable:false}),/chrome:\/\/flags/);
 assert.match(bluetoothUnavailableReason({...supported,policyAllowed:false}),/bloquea el permiso/);
 assert.match(bluetoothUnavailableReason({...supported,apiAvailable:false,policyAllowed:false}),/chrome:\/\/flags/);
});
test("cancelar el selector, bloqueo de permiso y error GATT tienen acciones distintas",()=>{
 assert.match(bluetoothConnectionError({name:"NotFoundError"},true),/canceló/);
 assert.match(bluetoothConnectionError({name:"SecurityError"},true),/permiso/);
 assert.match(bluetoothConnectionError({name:"NetworkError"},true),/bridge:ble/);
 assert.match(bluetoothConnectionError({name:"NotSupportedError"},true),/Chrome en Linux/);
});
test("GATT sin respuesta termina con un error visible en lugar de dejar el botón bloqueado",async()=>{
 await assert.rejects(bluetoothStep(new Promise(()=>{}),"GATT timeout",1),/GATT timeout/);
 assert.equal(await bluetoothStep(Promise.resolve("connected"),"timeout",1),"connected");
});
