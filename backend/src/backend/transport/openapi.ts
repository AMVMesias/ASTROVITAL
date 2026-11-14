const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const string = { type: "string" };
const timestamp = { type: "string", format: "date-time" };
const nullableString = { type: "string", nullable: true };
const jsonContent = (schema: unknown) => ({ "application/json": { schema } });
const response = (description: string, schema: unknown) => ({ description, content: jsonContent(schema) });
const body = (schema: unknown) => ({ required: true, content: jsonContent(schema) });
const errors = Object.fromEntries([400,401,403,404,409,413,415,429,500,503].map(status => [status, response(`Error ${status}: ver error.code y error.fields.`, ref("Error"))]));
const security = [{ sessionCookie: [] }];
const operation = (summary: string, tag: string, schema: unknown, options: Record<string, unknown> = {}) => ({ summary, tags: [tag], security, responses: { "200": response("Operación completada", schema), ...errors }, ...options });
const userEnvelope = { type: "object", properties: { user: ref("User") }, required: ["user"] };
const measurementInput = {
  type: "object", additionalProperties: false, required: ["indicator","value","unit","capturedAt"],
  properties: { indicator: { type: "string", enum: ["sleep","wellbeing"] }, value: { type: "number" }, unit: { type: "string", enum: ["h","score_1_5"] }, capturedAt: timestamp, activity: { type: "string", enum: ["rest","exercise","eva"], default: "rest" }, note: { type: "string", maxLength: 1000 } },
  description: "Sueño 0–24 h; bienestar entero 1–5. Límites de formato demo-format-1, no clínicos. Fecha UTC con Z, hasta 60 s de tolerancia futura. No se admite dueño ni origen del cliente.",
};
const userWrite = { type: "object", additionalProperties: false, properties: { username: { type: "string", minLength: 3, maxLength: 64, pattern: "^[a-zA-Z0-9._-]+$" }, name: { type: "string", minLength: 1, maxLength: 120 }, role: { type: "string", enum: ["admin","astronauta"] }, enabled: { type: "boolean", default: true }, password: { type: "string", format: "password", minLength: 12, maxLength: 128, writeOnly: true } } };
export const openapi = {
  openapi: "3.0.3",
  info: { title: "NASA Health · API local", version: "1.0.0", description: "Backend persona 1. SQLite local con Next.js/Node 22.13+. Login mediante cookie HttpOnly, revocación y separación de roles. Primero db:seed; sin credenciales por defecto. Swagger funciona sin CDN. Las mutaciones de sesión requieren Origin del mismo origen o X-Nasa-Request: 1 para clientes CLI. Los datos de salud son personales; admin no tiene acceso. Ambiente preparation-1 provisional, sin telemetría. PostgreSQL, evaluación y avisos corresponden a persona 2." },
  servers: [{ url: "/", description: "Mismo equipo local" }],
  tags: ["Acceso","Usuarios","Mediciones","Dispositivos","Disponibilidad"].map(name => ({ name })),
  paths: {
    "/api/health": { get: operation("Disponibilidad del servicio (sin comprobar SQLite)","Disponibilidad", { type: "object", properties: { status: { type: "string", enum: ["ok"] } } }, { security: [] }) },
    "/api/v1/auth/login": { post: operation("Iniciar sesión de cuenta habilitada", "Acceso", { type: "object", properties: { user: ref("User"), expiresAt: timestamp } }, { security: [], requestBody: body({ type: "object", additionalProperties: false, required: ["username","password"], properties: { username: string, password: { type: "string", format: "password", maxLength: 128 } } }) }) },
    "/api/v1/auth/session": { get: operation("Consultar identidad y vigencia", "Acceso", { type: "object", properties: { user: ref("User"), expiresAt: timestamp } }) },
    "/api/v1/auth/logout": { post: operation("Revocar la sesión actual", "Acceso", { type: "object", properties: { status: string } }) },
    "/api/v1/users": {
      get: operation("Listar cuentas y perfiles básicos (admin)", "Usuarios", { type: "object", properties: { users: { type: "array", items: ref("User") } } }),
      post: operation("Crear cuenta y asignación básica (admin)", "Usuarios", userEnvelope, { requestBody: body({ ...userWrite, required: ["username","name","role","password"] }), responses: { "201": response("Cuenta creada", userEnvelope), ...errors } }),
    },
    "/api/v1/users/{id}": { parameters: [{ name: "id", in: "path", required: true, schema: string }],
      get: operation("Consultar cuenta sin datos de salud (admin)", "Usuarios", userEnvelope),
      patch: operation("Editar, cambiar credencial/rol o habilitación (admin)", "Usuarios", userEnvelope, { description: "Cambio de rol/contraseña o inhabilitación revoca sesiones. Conserva autoría e historial. No permite retirar el último admin habilitado.", requestBody: body(userWrite) }),
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
    "/api/v1/me/measurements/latest": { get: operation("Últimos valores, dispositivos y estado local de cola (astronauta)", "Mediciones", ref("Summary")) },
    "/api/v1/me/device": { get: operation("Dispositivos propios y última comunicación (astronauta)", "Dispositivos", { type: "object", properties: { devices: { type: "array", items: ref("Device") } } }) },
    "/api/v1/measurements": { post: operation("Ingesta autenticada ESP32, deduplicada por dispositivo/readingId", "Dispositivos", ref("CaptureResult"), {
      security: [{ deviceBearer: [] }], parameters: [{ name: "X-Device-Id", in: "header", required: true, schema: string }],
      description: "Origen device, dueño resuelto por vínculo. Solo pulso 1–300 bpm (validación de formato, no regla clínica). Reenvío idéntico devuelve 200; otro contenido con el mismo ID devuelve 409. No usar cookie de usuario.",
      requestBody: body({ ...measurementInput, required: [...measurementInput.required,"readingId"], properties: { ...measurementInput.properties, indicator: { type: "string", enum: ["heart_rate"] }, unit: { type: "string", enum: ["bpm"] }, readingId: { type: "string", minLength: 1, maxLength: 128 } }, example: { readingId: "esp32-boot01-0001", indicator: "heart_rate", value: 68, unit: "bpm", capturedAt: "2026-11-14T12:00:00.000Z", activity: "rest" } }),
      responses: { "200": response("Reenvío idéntico",ref("CaptureResult")), "201": response("Lectura creada con pendiente",ref("CaptureResult")), ...errors },
    }) },
  },
  components: {
    securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "nasa_session", description: "Se establece al ejecutar login en este navegador. No se copia manualmente en Swagger." }, deviceBearer: { type: "http", scheme: "bearer", description: "Credencial del dispositivo aprovisionada por comando local." } },
    schemas: {
      Error: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code","message"], properties: { code: string, message: string, fields: { type: "object", additionalProperties: string } } } } },
      User: { type: "object", properties: { id: string, username: string, name: string, role: { type: "string", enum: ["astronauta","admin"] }, enabled: { type: "boolean" }, astronautId: nullableString, missionId: nullableString, moduleId: nullableString, createdAt: timestamp } },
      Environment: { type: "object", properties: { scenarioId: string, profileId: string, profileVersion: string, assignmentId: string, scope: { type: "string", enum: ["cabin","exterior"] }, telemetryAvailable: { type: "boolean" } } },
      Measurement: { type: "object", properties: { id: string, astronautId: string, missionId: string, moduleId: string, indicator: { type: "string", enum: ["sleep","wellbeing","heart_rate"] }, value: { type: "number" }, unit: string, origin: { type: "string", enum: ["manual","device","simulated"] }, quality: { type: "string", enum: ["valid"] }, capturedAt: timestamp, receivedAt: timestamp, authorId: nullableString, deviceId: nullableString, readingId: nullableString, activity: { type: "string", enum: ["rest","exercise","eva"] }, note: string, scenario: nullableString, environment: ref("Environment") } },
      Device: { type: "object", properties: { id: string, astronautId: string, enabled: { type: "boolean" }, lastCommunicationAt: { ...timestamp, nullable: true } } },
      CaptureResult: { type: "object", required: ["measurement","duplicate"], properties: { measurement: ref("Measurement"), duplicate: { type: "boolean" } } },
      Summary: { type: "object", properties: { latest: { type: "array", items: ref("Measurement") }, devices: { type: "array", items: ref("Device") }, environment: { ...ref("Environment"), nullable: true }, queue: { type: "object", properties: { pending: { type: "integer" }, confirmed: { type: "integer" }, rejected: { type: "integer" }, rejections: { type: "array", items: { type: "object", properties: { id: string, reason: nullableString } } } } }, indicators: { type: "object", description: "Configuración demo-format-1 de unidades y límites de formato." }, evaluation: { type: "object", properties: { status: { type: "string", enum: ["not_connected"] }, message: string } } } },
    },
  },
};
