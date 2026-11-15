import type {Indicator,TelemetryFields} from "./telemetryDecisionTree";

export type TelemetryAction={
 id:string;priority:"priority"|"check"|"follow_up";title:string;reason:string;
 steps:string[];expected:string;escalation?:string;
};
type Input={fields?:TelemetryFields;indicators:readonly Indicator[];stale:boolean;count:number};

/** Deterministic, traceable capture guidance. Does not prescribe oxygen, medication or suit settings. */
export function telemetryActions(input:Input):TelemetryAction[] {
 if(!input.fields)return [{id:"start-capture",priority:"check",title:"Iniciar una captura en este escenario",
  reason:"No hay muestras posteriores a la selección del entorno.",steps:["Conecta el ESP32 desde Bluetooth o inicia el puente del portátil.","Comprueba que avance la fecha de la última muestra antes de interpretar los valores."],expected:"Una muestra nueva del dispositivo vinculado, en el escenario seleccionado."}];
 if(input.stale)return [{id:"restore-capture",priority:"check",title:"Recuperar una lectura actual",
  reason:"La última muestra superó su tiempo de vigencia; estos valores no describen el estado actual.",steps:["Comprueba alimentación de la placa y conexión Bluetooth.","Reanuda la captura y revisa que cambien la fecha y el contador de confirmaciones."],expected:"Una muestra nueva con antigüedad dentro de la vigencia configurada; no basta con recargar la misma respuesta."}];
 const f=input.fields, actions:TelemetryAction[]=[];
 const metric=(key:string)=>input.indicators.find(value=>value.key===key);
 const spo2=metric("spo2")?.value??null, pulse=metric("bpm_oxi")?.value??null;
 if(spo2!==null&&spo2<95)actions.push({id:"verify-oxygen",priority:spo2<90?"priority":"check",
  title:`Comprobar SpO₂ de ${spo2} %`,reason:`La lectura activa la regla de revisión de oxigenación.${metric("spo2")?.checkRequired?" El pulso del mismo oxímetro también requiere comprobación; no se puede descartar la lectura baja como simple ruido.":" El estado válido del firmware no certifica precisión clínica."}`,
  steps:["Apoya la mano y mantén el dedo y el sensor sin movimiento; revisa el contacto según el montaje del dispositivo.","Espera a que la lectura se estabilice y contrástala con un oxímetro de uso médico; registra valor, hora y síntomas."],
  expected:"Una lectura estable y contrastada. No se trata de ajustar el sensor hasta obtener un número deseado.",
  escalation:spo2<90?"Si esta lectura corresponde a una persona, solicita valoración médica urgente. Ante dificultad respiratoria, dolor de pecho u otros síntomas graves, busca atención inmediata sin esperar a que funcionen los demás sensores.":"Si la lectura baja persiste, consulta a un profesional. Si hay síntomas graves, busca atención inmediata aunque el prototipo cambie de valor."});
 if(spo2===null)actions.push({id:"restore-oximeter",priority:"check",title:"Obtener una lectura utilizable del oxímetro",
  reason:f.estado_oxi_x50===0?"El firmware informa que el MAX30102 no está disponible.":f.estado_oxi_x50===50?"El firmware informa que no detecta dedo.":"El MAX30102 todavía no informa una SpO₂ válida.",
  steps:[f.estado_oxi_x50===0?"Con la captura detenida, revisa alimentación y conexión del módulo.":"Revisa la posición del dedo y mantén el sensor quieto hasta que termine su cálculo.","Vuelve a capturar; no interpretes el cero o la ausencia de dato como saturación sanguínea."],expected:"Estado de oxímetro válido y valor disponible; si no se consigue, usa un dispositivo de medición adecuado."});
 if(metric("bpm_oxi")?.checkRequired||((metric("bpm_oxi")?.alertLevel)&&pulse!==null))actions.push({id:"verify-oximeter-pulse",priority:"check",title:`Contrastar el pulso de ${pulse} lpm`,
  reason:metric("bpm_oxi")!.detail,
  steps:["Repite la captura sin mover la mano ni el sensor y comprueba si el pulso se estabiliza.",metric("bpm_ecg")?.value!=null?"Compara los pulsos ECG y oxímetro tomados al mismo tiempo; no promedies valores discrepantes.":"El ECG no tiene una frecuencia actual válida para comparar: utiliza un instrumento validado y recupera el contacto ECG."],
  expected:"Concordancia en una nueva captura. Un valor en el límite de formato o un salto brusco no demuestra un pulso real ni debe descartarse automáticamente como artefacto.",
  escalation:"Si el pulso extremo se confirma o hay malestar, solicita valoración médica. Ante dolor de pecho o dificultad respiratoria, busca atención inmediata; no esperes a recuperar el ECG."});
 if(metric("bpm_ecg")?.value===null)actions.push({id:"restore-ecg",priority:"check",title:"Recuperar la frecuencia por ECG",
  reason:f.estado_ecg_x50===0?"El AD8232 indica falta de contacto de electrodos.":f.estado_ecg_x50===50?"Se recibe señal eléctrica, pero el firmware no detecta latidos válidos.":"El firmware aún no entrega un BPM ECG utilizable.",
  steps:["Revisa el contacto y el cable de los electrodos del montaje y repite la captura sin movimiento.","Espera una nueva lectura con estado ECG válido y BPM positivo; una curva que se mueve no confirma latidos."],expected:"Frecuencia ECG actual y validada por el firmware; la última frecuencia histórica no sustituye ese dato."});
 else if(metric("bpm_ecg")?.alertLevel)actions.push({id:"review-ecg-change",priority:"check",title:"Verificar el cambio de frecuencia ECG",
  reason:"Se activó una regla de cambio reciente o de discrepancia entre sensores, no un diagnóstico.",steps:["Registra si la captura fue en reposo, ejercicio o EVA y comprueba contacto y movimiento.","Toma una lectura nueva en el mismo contexto y contrasta un cambio persistente con un instrumento validado."],expected:"Contexto documentado y comprobación del cambio; no usar una referencia de reposo para interpretar ejercicio o EVA."});
 if(metric("rpm")?.value===null)actions.push({id:"restore-respiration",priority:"check",title:"Recuperar la estimación respiratoria",
  reason:f.estado_resp_x50===0?"El firmware informa que el MPU6050 no está disponible.":"No hay RPM válidas; esto no demuestra ausencia de respiración de la persona.",
  steps:[f.estado_resp_x50===0?"Con la captura detenida, revisa conexión y alimentación del MPU6050.":"Revisa la colocación del MPU6050 según el montaje y evita moverlo manualmente durante la captura.","Comprueba que una lectura nueva entregue RPM y estado de respiración válido."],expected:"RPM disponibles. La urgencia de una lectura baja de oxígeno o de síntomas no depende de recuperar este sensor."});
 if(!actions.length)actions.push({id:"record-context",priority:"follow_up",title:input.count<3?"Completar la ventana de observación":"Registrar el contexto de esta captura",
  reason:input.count<3?`Solo hay ${input.count} instantáneas recientes; no permiten describir una tendencia consistente.`:"Las lecturas disponibles no activaron las reglas configuradas en esta captura.",
  steps:["Mantén la captura activa y confirma que llegan nuevas muestras del mismo dispositivo.","Registra actividad, cambios de postura y síntomas en el seguimiento; revisa cualquier cambio persistente."],expected:"Nuevas muestras comparables y contexto registrado; la ausencia de alerta no certifica ausencia de riesgo."});
 return actions;
}
