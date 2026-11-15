import { telemetryFields } from "../application/measurements/TelemetryService";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const string = { type: "string" };
const timestamp = { type: "string", format: "date-time" };
const nullableString = { type: "string", nullable: true };
const jsonContent = (schema: unknown) => ({ "application/json": { schema } });
const response = (description: string, schema: unknown) => ({ description, content: jsonContent(schema) });
const body = (schema: unknown) => ({ required: true, content: jsonContent(schema) });
const errors = Object.fromEntries([400,401,403,404,409,410,413,415,429,500,503].map(status => [status, response(`Error ${status}: ver error.code y error.fields.`, ref("Error"))]));
const security = [{ sessionCookie: [] }];
const operation = (summary: string, tag: string, schema: unknown, options: Record<string, unknown> = {}) => ({ summary, tags: [tag], security, responses: { "200": response("Operación completada", schema), ...errors }, ...options });
const userEnvelope = { type: "object", properties: { user: ref("User") }, required: ["user"] };
const measurementInput = {
  type: "object", additionalProperties: false, required: ["indicator","value","unit","capturedAt"],
  properties: { indicator: { type: "string", enum: ["sleep","wellbeing"] }, value: { type: "number" }, unit: { type: "string", enum: ["h","score_1_5"] }, capturedAt: timestamp, activity: { type: "string", enum: ["rest","exercise","eva","unknown"], default: "unknown", description: "Contexto declarado explícitamente por el productor autenticado. Omitirlo no confirma reposo." }, note: { type: "string", maxLength: 1000 } },
  description: "Sueño 0–24 h; bienestar entero 1–5. Límites de formato demo-format-1, no clínicos. Fecha UTC con Z, hasta 60 s de tolerancia futura. No se admite dueño ni origen del cliente.",
};
const userWrite = { type: "object", additionalProperties: false, properties: { username: { type: "string", minLength: 3, maxLength: 64, pattern: "^[a-zA-Z0-9._-]+$" }, name: { type: "string", minLength: 1, maxLength: 120 }, role: { type: "string", enum: ["admin","astronauta"] }, enabled: { type: "boolean", default: true }, password: { type: "string", format: "password", minLength: 12, maxLength: 128, writeOnly: true } } };

const recoveryPassword = {
  newPassword:{type:"string",format:"password",writeOnly:true,minLength:12,maxLength:128},
  confirmation:{type:"string",format:"password",writeOnly:true,minLength:12,maxLength:128},
};
const recoveryResult={type:"object",properties:{status:string,requiresLogin:{type:"boolean"}}};
export const openapi = {
  openapi: "3.0.3",
  info: { title: "NASA Health · API", version: "1.0.0", description: "AstroVital: API Next.js con PostgreSQL en Supabase. Sesiones HttpOnly, roles admin y astronauta, primer acceso, recuperación, mediciones y evaluación. Requiere conexión a Internet. Las mutaciones requieren un origen autorizado o X-Nasa-Request: 1. No hay credenciales predeterminadas." },
  servers: [{ url: "/", description: "Mismo dominio mediante proxy" }],
  tags: ["Acceso","Usuarios","Mediciones","Dispositivos","Disponibilidad","Sincronización","Avisos"].map(name => ({ name })),
  paths: {
    "/api/v1/users/{id}/devices": {post:operation("Vincular un ESP32 al astronauta (administrador)","Dispositivos",{type:"object",properties:{deviceId:string,status:{type:"string",enum:["linked"]}}},{parameters:[{name:"id",in:"path",required:true,schema:string}],requestBody:body({type:"object",additionalProperties:false,required:["deviceId"],properties:{deviceId:{type:"string",pattern:"^[a-zA-Z0-9._-]{1,64}$"}}})})},
    "/api/v1/me/device/capture": {post:operation("Captura BLE desde la sesión del astronauta; solo dispositivos propios", "Dispositivos", {type:"object",properties:{status:string,telemetry:{type:"object"},measurement:ref("CaptureResult"),evaluation:{type:"object"}}}, {requestBody:body({type:"object",additionalProperties:false,required:["deviceId"],properties:{deviceId:{type:"string",minLength:1,maxLength:64},telemetry:ref("TelemetryInput"),measurement:{type:"object",additionalProperties:false,required:["readingId","indicator","value","unit","capturedAt"],properties:{readingId:string,indicator:{type:"string",enum:["heart_rate"]},value:{type:"number",minimum:1,maximum:300},unit:{type:"string",enum:["bpm"]},capturedAt:timestamp,activity:{type:"string",enum:["rest","exercise","eva"]},note:string}},signal:{type:"object",additionalProperties:false,required:["status","observedAt"],properties:{status:{type:"string",enum:["no_contact","no_signal","insufficient","disconnected"]},observedAt:timestamp}}}})})},
    "/api/v1/devices/telemetry": {post:operation("Guardar los once campos crudos y estados del ESP32", "Dispositivos", {type:"object",properties:{status:string,readingId:string,duplicate:{type:"boolean"}}}, {security:[{deviceBearer:[]}],parameters:[{name:"X-Device-Id",in:"header",required:true,schema:string}],requestBody:body(ref("TelemetryInput"))})},
    "/api/v1/me/telemetry": {get:operation("Historial propio de todos los campos ESP32 (incluye ceros crudos)", "Mediciones", ref("TelemetryHistory"), {parameters:[{name:"field",in:"query",schema:{type:"string",enum:telemetryFields}},...(["from","to"] as const).map(name=>({name,in:"query",schema:timestamp})),{name:"limit",in:"query",schema:{type:"integer",minimum:1,maximum:500,default:50}},{name:"offset",in:"query",schema:{type:"integer",minimum:0,default:0}}]})},
    "/api/v1/me/telemetry/latest": {get:operation("Última instantánea propia: ECG, respiración y oxímetro", "Mediciones", ref("TelemetryHistory"))},
    "/api/v1/auth/security-questions": {get:operation("Consultar catálogo de preguntas", "Acceso", {type:"object",properties:{questions:{type:"array",items:ref("SecurityQuestion")}}},{security:[]})},
    "/api/v1/auth/onboarding": {
      get:operation("Consultar primer acceso y preguntas propias sin respuestas", "Acceso", {type:"object",properties:{requiresOnboarding:{type:"boolean"},securityQuestionsConfigured:{type:"boolean"},questions:{type:"array",items:ref("SecurityQuestion")},recoveryLocked:{type:"boolean"}}}),
      post:operation("Completar primer acceso y revocar sesiones", "Acceso", recoveryResult, {description:"Admite sesión restringida. Guarda contraseña distinta de la inicial y exactamente tres respuestas hasheadas. Las cuentas existentes sin preguntas pueden configurarlas una vez. Después requiere login nuevo.",requestBody:body({type:"object",additionalProperties:false,required:["newPassword","confirmation","answers"],properties:{...recoveryPassword,answers:{type:"array",minItems:3,maxItems:3,items:{type:"object",additionalProperties:false,required:["questionId","answer"],properties:{questionId:string,answer:{type:"string",writeOnly:true,minLength:1,maxLength:200}}}}}})}),
    },
    "/api/v1/auth/recovery/start": {post:operation("Solicitar o reutilizar desafío de recuperación", "Acceso", ref("RecoveryChallenge"), {security:[],description:"Pregunta elegida por el servidor, fija durante 10 minutos. Solicitar otro desafío no reinicia los tres intentos. Cuentas inexistentes o sin configuración reciben desafíos que no autorizan cambios.",requestBody:body({type:"object",additionalProperties:false,required:["username"],properties:{username:{type:"string",maxLength:64}}})})},
    "/api/v1/auth/recovery/verify": {post:operation("Verificar respuesta y emitir autorización de 5 minutos", "Acceso", {type:"object",properties:{resetToken:string,expiresAt:timestamp}}, {security:[],description:"Máximo tres respuestas incorrectas por cuenta, persistidas entre desafíos y reinicios. El token se devuelve una vez y se almacena solo como hash. El desafío ya verificado no se puede reutilizar.",requestBody:body({type:"object",additionalProperties:false,required:["challengeId","answer"],properties:{challengeId:{type:"string",minLength:64,maxLength:64},answer:{type:"string",format:"password",writeOnly:true,minLength:1,maxLength:200}}})})},
    "/api/v1/auth/recovery/reset": {post:operation("Cambiar contraseña con autorización de un solo uso", "Acceso", recoveryResult, {security:[],description:"No acepta cambios sin token válido. Revoca todas las sesiones y autorizaciones de recuperación. No inicia sesión automáticamente.",requestBody:body({type:"object",additionalProperties:false,required:["resetToken","newPassword","confirmation"],properties:{resetToken:{type:"string",format:"password",writeOnly:true,minLength:64,maxLength:64},...recoveryPassword}})})},
    "/api/v1/users/{id}/recovery/unlock": {parameters:[{name:"id",in:"path",required:true,schema:string}],post:operation("Desbloquear recuperación y revocar desafíos (admin)", "Usuarios", {type:"object",properties:{status:{type:"string",enum:["unlocked"]}}},{description:"Conserva preguntas y contraseña. Para reemplazar credencial y preguntas, usar PATCH de usuario con password: fuerza primer acceso y elimina respuestas previas."})},
    "/api/v1/me/environment": {
      get: operation("Catálogo documental y asignación propia (astronauta)", "Mediciones", {type:"object",properties:{revision:string,profiles:{type:"array",items:{type:"object"}},sources:{type:"object"},active:{...ref("Environment"),nullable:true},assignment:{type:"object",nullable:true},telemetryAvailable:{type:"boolean"}}}),
      put: operation("Seleccionar escenario con la revisión vigente (astronauta)", "Mediciones", {type:"object",properties:{active:ref("Environment")}}, {requestBody:body({type:"object",additionalProperties:false,required:["scenarioId"],properties:{scenarioId:{type:"string",enum:["deep_space_transit","iss_leo","moon_surface","mars_surface"]}}})}),
      post: operation("Seleccionar escenario desde ahora (astronauta)", "Mediciones", {type:"object",properties:{assignment:{type:"object"}}}, {requestBody:body({type:"object",additionalProperties:false,required:["scenarioId","revision"],properties:{scenarioId:{type:"string",enum:["deep_space_transit","iss_leo","moon_surface","mars_surface"]},revision:string}})}),
    },
    "/api/v1/me/alerts": {
      get: operation("Listar avisos propios", "Avisos", { type: "object", properties: { alerts: { type: "array", items: ref("Alert") } } }),
    },
    "/api/v1/me/alerts/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: string }],
      get: operation("Consultar aviso propio y acciones", "Avisos", ref("AlertDetail")),
      post: operation("Registrar acción sobre aviso propio", "Avisos", ref("AlertDetail"), {
        requestBody: body({ type: "object", required: ["type"], properties: {
          type: { type: "string", enum: ["observation","repeat","track","close"] }, note: { type: "string", maxLength: 1000 },
        } }),
      }),
    },
    "/api/v1/devices/status": {post:operation("Registrar pérdida de señal/contacto sin crear medición", "Dispositivos", {type:"object",properties:{status:{type:"string",enum:["recorded"]}}}, {
      security:[{deviceBearer:[]}],parameters:[{name:"X-Device-Id",in:"header",required:true,schema:string}],
      requestBody:body({type:"object",additionalProperties:false,required:["status","observedAt"],properties:{status:{type:"string",enum:["no_contact","no_signal","insufficient","disconnected"]},observedAt:timestamp}}),
    })},
    "/api/health": { get: operation("Disponibilidad del servicio (sin comprobar PostgreSQL)","Disponibilidad", { type: "object", properties: { status: { type: "string", enum: ["ok"] } } }, { security: [] }) },
    "/api/v1/auth/login": { post: operation("Iniciar sesión; user.requiresOnboarding indica acceso restringido", "Acceso", { type: "object", properties: { user: ref("User"), expiresAt: timestamp } }, { security: [], requestBody: body({ type: "object", additionalProperties: false, required: ["username","password"], properties: { username: string, password: { type: "string", format: "password", maxLength: 128 } } }) }) },
    "/api/v1/auth/session": { get: operation("Consultar identidad y vigencia", "Acceso", { type: "object", properties: { user: ref("User"), expiresAt: timestamp } }) },
    "/api/v1/auth/logout": { post: operation("Revocar la sesión actual", "Acceso", { type: "object", properties: { status: string } }) },
    "/api/v1/users": {
      get: operation("Listar cuentas y perfiles básicos (admin)", "Usuarios", { type: "object", properties: { users: { type: "array", items: ref("User") } } }),
      post: operation("Crear cuenta y asignación básica (admin)", "Usuarios", userEnvelope, { requestBody: body({ ...userWrite, required: ["username","name","role","password"] }), responses: { "201": response("Cuenta creada", userEnvelope), ...errors } }),
    },
    "/api/v1/users/{id}": { parameters: [{ name: "id", in: "path", required: true, schema: string }],
      get: operation("Consultar cuenta sin datos de salud (admin)", "Usuarios", userEnvelope),
      patch: operation("Editar, cambiar credencial/rol o habilitación (admin)", "Usuarios", userEnvelope, { description: "Cambio de rol/contraseña o inhabilitación revoca sesiones y autorizaciones de recuperación. Cambiar contraseña también elimina preguntas y exige primer acceso. Conserva autoría e historial. No permite retirar el último admin habilitado.", requestBody: body(userWrite) }),
    },
    "/api/v1/me/measurements": {
      get: operation("Historial propio (astronauta)", "Mediciones", { type: "object", properties: { measurements: { type: "array", items: ref("Measurement") } } }, { parameters: [
        { name: "indicator", in: "query", schema: { type: "string", enum: ["sleep","wellbeing","heart_rate"] } },
        ...["from","to"].map(name => ({ name, in: "query", schema: timestamp })),
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
        { name: "offset", in: "query", schema: { type: "integer", minimum: 0, maximum: 1000000, default: 0 } },
      ] }),
      post: operation("Capturar sueño/bienestar propio (astronauta)", "Mediciones", ref("CaptureResult"), { requestBody: body({ ...measurementInput, example: { indicator: "sleep", value: 7.5, unit: "h", capturedAt: "2026-11-14T08:00:00.000Z", activity: "rest" } }), responses: { "201": response("Medición y pendiente persistidos juntos", ref("CaptureResult")), ...errors } }),
    },
    "/api/v1/me/measurements/latest": { get: operation("Últimos valores, dispositivos y evaluación (astronauta)", "Mediciones", ref("Summary")) },
    "/api/v1/me/device": { get: operation("Dispositivos propios y última comunicación (astronauta)", "Dispositivos", { type: "object", properties: { devices: { type: "array", items: ref("Device") } } }) },
    "/api/v1/measurements": { post: operation("Ingesta autenticada ESP32, deduplicada por dispositivo/readingId", "Dispositivos", ref("CaptureResult"), {
      security: [{ deviceBearer: [] }], parameters: [{ name: "X-Device-Id", in: "header", required: true, schema: string }],
      description: "Origen device, dueño resuelto por vínculo. Solo pulso 1–300 bpm (validación de formato, no regla clínica). Reenvío idéntico devuelve 200; otro contenido con el mismo ID devuelve 409. No usar cookie de usuario.",
      requestBody: body({ ...measurementInput, required: [...measurementInput.required,"readingId"], properties: { ...measurementInput.properties, indicator: { type: "string", enum: ["heart_rate"] }, unit: { type: "string", enum: ["bpm"] }, readingId: { type: "string", minLength: 1, maxLength: 128 } }, example: { readingId: "esp32-boot01-0001", indicator: "heart_rate", value: 68, unit: "bpm", capturedAt: "2026-11-14T12:00:00.000Z", activity: "rest" } }),
      responses: { "200": response("Reenvío idéntico",ref("CaptureResult")), "201": response("Lectura creada con pendiente",ref("CaptureResult")), ...errors },
    }) },
  },
  components: {
    securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "nasa_session", description: "Se establece al ejecutar login en este navegador. No se copia manualmente en Swagger." }, deviceBearer: { type: "http", scheme: "bearer", description: "Credencial del dispositivo aprovisionada por comando administrativo." } },
    schemas: {
      TelemetryInput:{type:"object",additionalProperties:false,required:["readingId","capturedAt","fields"],properties:{readingId:string,capturedAt:timestamp,fields:{type:"object",additionalProperties:false,required:telemetryFields,properties:Object.fromEntries(telemetryFields.map(name=>[name,{type:"number"}]))}}},
      TelemetryHistory:{type:"object",description:"Instantáneas a máximo 1 Hz. Señales crudas sin evaluación clínica ni sincronización nube; los valores derivados no disponibles son null. Fecha de recepción del portátil.",properties:{availableFields:{type:"array",items:{type:"string",enum:telemetryFields}},samples:{type:"array",items:{type:"object",properties:{readingId:string,capturedAt:timestamp,fields:{type:"object",properties:Object.fromEntries(telemetryFields.map(name=>[name,{type:"number"}]))},deviceId:string,receivedAt:timestamp,clock:string,ageSeconds:{type:"integer"},sensors:{type:"object"}}}}}},
      SecurityQuestion:{type:"object",properties:{id:string,label:string}},
      RecoveryChallenge:{type:"object",properties:{challengeId:string,question:ref("SecurityQuestion"),expiresAt:timestamp,attemptsRemaining:{type:"integer",minimum:0,maximum:3}}},
      Recommendation: { type: "object", required: ["id", "version", "action", "message"], properties: {
        id: string, version: string, action: { type: "string", enum: ["repeat_reading", "collect_history", "track"] },
        message: { type: "object", required: ["es", "en"], properties: { es: string, en: string } },
      } },
      Assessment: {type:"object",properties:{status:{type:"string",enum:["insufficient","invalid","stale","stable","deviation"]},ruleVersion:string,direction:{type:"string",enum:["above","below"]},recommendation:ref("Recommendation"),evidence:{type:"array",items:string},reference:{type:"object",properties:{mean:{type:"number"},count:{type:"integer"},from:timestamp,to:timestamp}}}},
      SyncMeasurement: {
        allOf: [
          ref("Measurement"),
          { type: "object", required: ["id", "astronautId", "missionId", "moduleId", "indicator", "value", "unit",
            "origin", "quality", "capturedAt", "receivedAt", "authorId", "deviceId", "readingId", "activity", "note", "scenario", "environment"],
            properties: { capturedAt: { ...timestamp, example: "2026-11-14T12:00:00.000Z" }, receivedAt: { ...timestamp, example: "2026-11-14T12:00:01.000Z" },
              environment: { allOf: [ref("Environment")], required: ["scenarioId", "profileId", "profileVersion", "scope", "assignmentId", "telemetryAvailable"] } },
          },
        ],
      },
      Alert: { type: "object", properties: { id: string, measurementId: string, missionId: string, astronautId: string, createdAt: timestamp,
        kind: { type: "string", enum: ["quality","variation"] }, reason: { type: "string", enum: ["invalid","stale","deviation"] },
        status: { type: "string", enum: ["open","tracking","closed"] }, evidence: ref("Assessment"),
      } },
      AlertDetail: { type: "object", properties: { alert: ref("Alert"), actions: { type: "array", items: {
        type: "object", properties: { authorId: string, type: { type: "string", enum: ["observation","repeat","track","close"] }, note: string, createdAt: timestamp },
      } } } },
      Error: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code","message"], properties: { code: string, message: string, fields: { type: "object", additionalProperties: string } } } } },
      User: { type: "object", properties: { id: string, username: string, name: string, role: { type: "string", enum: ["astronauta","admin"] }, enabled: { type: "boolean" }, requiresOnboarding:{type:"boolean",description:"Si es true, solo admite sesión, logout y primer acceso."}, astronautId: nullableString, missionId: nullableString, moduleId: nullableString, createdAt: timestamp } },
      Environment: { type: "object", properties: { scenarioId: string, profileId: string, profileVersion: string, assignmentId: string, scope: { type: "string", enum: ["cabin","exterior"] }, telemetryAvailable: { type: "boolean" } } },
      Measurement: { type: "object", properties: { id: string, astronautId: string, missionId: string, moduleId: string, indicator: { type: "string", enum: ["sleep","wellbeing","heart_rate"] }, value: { type: "number" }, unit: string, origin: { type: "string", enum: ["manual","device","simulated"] }, quality: { type: "string", enum: ["valid"] }, capturedAt: timestamp, receivedAt: timestamp, authorId: nullableString, deviceId: nullableString, readingId: nullableString, activity: { type: "string", enum: ["rest","exercise","eva","unknown"] }, activityConfirmed: { type: "boolean", description: "Confirmación explícita en la captura; ausente en históricos sin trazabilidad." }, maxAgeSeconds: { type: "number", description: "Solo en el resumen: vigencia configurada por la regla del indicador, en segundos." }, note: string, scenario: nullableString, environment: ref("Environment") } },
      Device: { type: "object", properties: { id: string, astronautId: string, enabled: { type: "boolean" }, lastCommunicationAt: { ...timestamp, nullable: true },signal:{type:"object",nullable:true,properties:{status:{type:"string",enum:["valid","no_contact","no_signal","insufficient","disconnected"]},observedAt:timestamp}} } },
      CaptureResult: { type: "object", required: ["measurement","duplicate"], properties: { measurement: ref("Measurement"), duplicate: { type: "boolean" },evaluation:{type:"object",properties:{status:{type:"string",enum:["done","pending"]},assessment:ref("Assessment"),code:string}} } },
      Summary: { type: "object", properties: { telemetry:{type:"object",nullable:true,description:"Última instantánea de once campos crudos y estados; no certifica mediciones clínicas."}, latest: { type: "array", items: ref("Measurement") }, devices: { type: "array", items: ref("Device") }, environment: { ...ref("Environment"), nullable: true }, indicators: { type: "object", description: "Configuración demo-format-1 de unidades y límites de formato." }, evaluation: {type:"array",items:{type:"object",properties:{measurementId:string,indicator:{type:"string",enum:["heart_rate","sleep","wellbeing"]},status:{type:"string",enum:["insufficient","invalid","stale","stable","deviation"]},ruleVersion:string,direction:{type:"string",enum:["above","below"]},recommendation:ref("Recommendation"),evidence:{type:"array",items:string},reference:{type:"object"},assessment:ref("Assessment")}}} } },
    },
  },
};
