export type BluetoothEnvironment = {secure:boolean;apiAvailable:boolean;policyAllowed:boolean;linux:boolean};

export function bluetoothUnavailableReason(environment:BluetoothEnvironment):string {
  if(!environment.secure)return "Bluetooth necesita HTTPS o http://localhost. Abre la URL segura de AstroVital.";
  if(!environment.apiAvailable)return environment.linux
    ? "Web Bluetooth no está habilitado en este navegador Linux. En Chrome/Chromium abre chrome://flags/#enable-experimental-web-platform-features, activa Experimental Web Platform features y reinicia el navegador."
    : "Este navegador no ofrece Web Bluetooth. Usa un navegador compatible y comprueba los permisos del sitio.";
  if(!environment.policyAllowed)return "El navegador o la página contenedora bloquea el permiso Bluetooth. Abre AstroVital directamente en una pestaña y revisa los permisos del sitio.";
  return "";
}

export function bluetoothConnectionError(error:unknown,linux:boolean):string {
  const name=error&&typeof error==="object"&&"name" in error?String(error.name):"";
  if(name==="NotFoundError")return "No se seleccionó una placa o se canceló la búsqueda. Enciende ASTROVITAL_BLE, comprueba que esté anunciándose y vuelve a pulsar Conectar ESP32.";
  if(name==="SecurityError"||name==="NotAllowedError")return "Chrome bloqueó el permiso Bluetooth. Abre AstroVital directamente por HTTPS, revisa los permisos del sitio y pulsa Conectar ESP32 de nuevo.";
  if(name==="NotSupportedError")return linux
    ? "Bluetooth no está habilitado por Chrome en Linux. Revisa chrome://flags/#enable-experimental-web-platform-features y reinicia Chrome."
    : "Esta operación Bluetooth no está disponible en el navegador o adaptador actual.";
  if(name==="NetworkError"||name==="InvalidStateError")return "No se pudo abrir la conexión GATT. Comprueba Bluetooth y la placa; detén bridge:ble u otra pestaña que use el ESP32 y vuelve a conectar.";
  return error instanceof Error?error.message:"No se pudo conectar por Bluetooth. Revisa el adaptador y vuelve a intentarlo.";
}

export async function bluetoothStep<T>(work:Promise<T>,message:string,timeoutMs=15000):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),timeoutMs);})]);}
  finally {clearTimeout(timer);}
}
