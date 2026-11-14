# Backend de persona 1 · Operación y contratos

Implementación: Next.js App Router, TypeScript y SQLite local con `node:sqlite`. Requiere Node **22.13+ dentro de la rama 22**; SQLite es experimental en esa rama y no requiere compilar dependencias nativas adicionales. En Vercel o con `APP_MODE=cloud`, las operaciones locales devuelven `503 LOCAL_ONLY`, sin abrir SQLite. PostgreSQL, evaluación, avisos y recepción de sincronización corresponden a persona 2.

La autorización se comprueba en endpoints y casos de uso. La conexión del frontend a estas operaciones sigue pendiente.

## Preparación

1. Ejecutar `npm ci` con Node 22.
2. Copiar `src/backend/.env.example` a `src/backend/.env.local`. Los comandos admiten el `.env.local` antiguo en raíz si no existe el del backend. Definir `ADMIN_PASSWORD` de 12–128 caracteres; `ADMIN_USERNAME` es `admin` por defecto. No hay contraseña predeterminada.
3. Ejecutar `npm run db:migrate` y `npm run db:seed`. Repetirlos no duplica datos ni cambia credenciales existentes.
4. Ejecutar `npm run dev:backend` para abrir la API, y `npm run dev:frontend` en otra terminal para usar la interfaz.
5. Abrir Swagger en `http://localhost:3001/api/docs` directamente o en `http://localhost:3000/api/docs` con el frontend iniciado. El esquema está en `/api/openapi`.

Base predeterminada: `data/local/nasa-health.sqlite`, configurable con `SQLITE_PATH`. La base y sus auxiliares se excluyen de Git. Las migraciones también se aplican al abrir la base; las semillas siempre son explícitas. Misión `demo-mission`, módulo `demo-module` y parámetros son demostrativos. Cada prueba usa una base temporal; no borrar una base real para reiniciar escenarios. Coordinar IDs de migración con persona 2; no editar migraciones ya aplicadas.

El modo sin Internet necesita que Next.js permanezca disponible en la LAN. Los datos del catálogo científico en `data/` no se convierten automáticamente en telemetría ni biometría.

## Swagger / OpenAPI

Swagger UI se sirve desde `swagger-ui-dist` mediante el backend: sin CDN, sin validador remoto. `/api/docs`, `/api/openapi` y sus dos assets permitidos son públicos.

En Swagger ejecutar login y después las operaciones del rol. La cookie HttpOnly se almacena en el navegador: el token no aparece en JSON ni se copia manualmente en Authorize. Para ESP32 usar Authorize con la credencial Bearer y completar `X-Device-Id`.

Las mutaciones de sesión requieren `Origin` del mismo origen o `X-Nasa-Request: 1` para CLI sin Origin; Swagger añade ese encabezado. `APP_ORIGIN` permite fijar el origen exacto. Se acepta también el origen propio del backend para Swagger directo. Se rechaza cross-site y no se configura CORS abierto. Cookie HttpOnly, SameSite Strict, duración de ocho horas. Usar `COOKIE_SECURE=true` con HTTPS y `false` en LAN HTTP de demo.

## Endpoints

| Método y ruta | Acceso |
| --- | --- |
| `GET /api/health` | Disponibilidad existente, sin dependencia de SQLite |
| `POST /api/v1/auth/login` | Credenciales de cuenta habilitada |
| `GET /api/v1/auth/session` | Sesión vigente; devuelve identidad sin secretos |
| `POST /api/v1/auth/logout` | Revoca sesión y elimina cookie |
| `GET /api/v1/users` | Admin; cuentas/perfiles básicos |
| `POST /api/v1/users` | Admin; alta y asignación del astronauta a misión/módulo base |
| `GET /api/v1/users/{id}` | Admin; consulta administrativa |
| `PATCH /api/v1/users/{id}` | Admin; usuario, nombre, rol, habilitación y contraseña |
| `POST /api/v1/me/measurements` | Astronauta; sueño y bienestar propios |
| `GET /api/v1/me/measurements` | Astronauta; historial propio |
| `GET /api/v1/me/measurements/latest` | Astronauta; últimos valores, dispositivos, contexto y estado de cola propios |
| `GET /api/v1/me/device` | Astronauta; dispositivos y última comunicación propios |
| `POST /api/v1/measurements` | Credencial de dispositivo; pulso del astronauta vinculado |
| `POST /api/v1/sync/measurements` | Credencial del equipo local; confirma mediciones de la misión autorizada en PostgreSQL |

El admin no consulta ni captura salud; el astronauta no administra cuentas. Los casos de uso vuelven a comprobar la sesión y el rol. Los DTO administrativos excluyen hashes, tokens, mediciones y avisos. Cambio de rol/contraseña o inhabilitación revoca sesiones y autorizaciones de recuperación dentro de la misma transacción. Cambiar una contraseña desde administración exige primer acceso y reemplazar las preguntas. Se conserva perfil, historial y autoría administrativa, sin guardar secretos en auditoría. No se permite retirar el último admin habilitado.

Usuarios: se normalizan a minúsculas; 3–64 caracteres ASCII entre letras, números, punto, guion y guion bajo. Contraseñas: scrypt con sal aleatoria. Sesiones: tokens aleatorios de 256 bits, solo SHA-256 en base. Cinco fallos de login durante una ventana de un minuto bloquean el identificador 15 minutos; mensaje genérico para cuenta inexistente, credencial errónea e inhabilitación.

## Captura

Configuración demostrativa `demo-format-1`, pendiente de revisión del equipo. Son límites de formato, no umbrales clínicos ni reglas de aviso:

| Indicador | Unidad | Formato |
| --- | --- | --- |
| `sleep` | `h` | Número finito 0–24 |
| `wellbeing` | `score_1_5` | Entero 1–5 |
| `heart_rate` | `bpm` | Número finito 1–300; dispositivo o simulador |

Entradas inválidas devuelven `400 VALIDATION`: no se guardan como válidas ni generan pendientes. Los avisos de calidad por entradas rechazadas quedan a coordinar con persona 2.

Ejemplo manual con cookie de astronauta:

```json
{"indicator":"sleep","value":7.5,"unit":"h","capturedAt":"2026-11-14T08:00:00.000Z","activity":"rest","note":"Registro de demo"}
```

Usar fecha original UTC terminada en `Z`; tolerancia futura de 60 s por desfase de reloj. Se guardan captura y recepción separadas. Actividad: `rest`, `exercise` o `eva`. El cliente no puede asignar dueño, autor, origen o calidad. Se rechazan campos desconocidos. Una medición y su pendiente se guardan en una única transacción SQLite.

Historial: filtros `indicator`, `from`, `to`, `limit` (1–200, defecto 50), `offset` (0–1000000). Orden descendente por captura e ID. Los últimos valores conservan su fecha, antigüedad y evaluación mediante reglas demostrativas versionadas.

## Dispositivo y simulador

Crear primero la cuenta de astronauta por API. Configurar `DEVICE_USERNAME`, `DEVICE_ID`, `DEVICE_TOKEN` (32–256 caracteres) y ejecutar `npm run device:provision`. Habilita vínculo y rota credencial, sin imprimirla. No reasigna el mismo dispositivo a otra persona; usar otro ID para conservar procedencia. `npm run device:revoke` usa `DEVICE_ID` y conserva historial.

Enviar a `/api/v1/measurements` con `Content-Type: application/json`, `X-Device-Id` y `Authorization: Bearer <credencial>`:

```json
{"readingId":"boot-001-reading-0001","indicator":"heart_rate","value":68,"unit":"bpm","capturedAt":"2026-11-14T12:00:00.000Z","activity":"rest"}
```

El dispositivo y su dueño deben estar habilitados; el dueño debe ser astronauta. Primer envío: 201. Reenvío idéntico normalizado: 200 con `duplicate:true`, mismo ID y contexto original. Mismo readingId con otro contenido: 409. La última comunicación se actualiza en aceptaciones, incluidos reintentos idénticos. El firmware debe mantener IDs únicos tras reinicio. Hardware físico y frecuencia de muestreo aún no verificados.

Para demo definir `DEMO_USERNAME` de un astronauta existente y `DEMO_RUN_ID`; ejecutar `npm run demo:simulate`. Genera 33 lecturas de sueño/bienestar/pulso en 12 intervalos, con un intervalo sin muestras y variación deliberada. Pasan por el mismo registro transaccional, conservan origen `simulated` y escenario. No derivan cifras fisiológicas del catálogo. `DEMO_SPAN_SECONDS` define la duración total (60 s por defecto), limitada por la fecha de creación de la cuenta para no inventar asignaciones anteriores; la simulación también procesa los trabajos de evaluación. Repetir el mismo DEMO_RUN_ID se rechaza; usar otro sin borrar datos. No hay endpoint público de simulación.

## Puente USB Serial y BLE

Implementado el puente del portátil con cola SQLite propia y credencial del dispositivo: `npm run bridge:serial` para el CSV del sketch proporcionado y `npm run bridge:ble` para el contrato GATT propuesto. Ver instalación, configuración, ejemplos y límites en [PUENTE_ESP32.md](PUENTE_ESP32.md). El firmware actual no tiene BLE ni reloj UTC; sus instantáneas se identifican con hora de recepción del portátil. Los UUID y la prueba física siguen pendientes de firmware/hardware.

`POST /api/v1/devices/status` recibe estados autenticados sin convertir pérdida de señal en BPM cero. `GET /api/v1/me/device` expone señal y última comunicación; el historial conserva la última lectura. Los reintentos antiguos no reemplazan el estado más reciente.

## Contratos con persona 2

`EnvironmentProvider.resolve(astronautId,capturedAt)` devuelve escenario, perfil/versión inmutable, ámbito, ID de asignación y disponibilidad de telemetría para la fecha original. `null` produce `409 ENVIRONMENT_MISSING`; perfil sin telemetría permite captura. La deduplicación ESP32 ocurre antes de consultar nuevamente el entorno.

La composición usa **HistoricalEnvironmentProvider**, conectado al repositorio de persona 2 en la conexión SQLite compartida. `db:seed` carga los cuatro perfiles y fuentes con su revisión de contenido. Una cuenta nueva de astronauta recibe cabina ISS desde su fecha de creación; las cuentas previas sin asignación se preparan al repetir la semilla, conservando asignaciones existentes. Una lectura anterior al primer intervalo devuelve `ENVIRONMENT_MISSING`, sin inventar historia. `GET/POST /api/v1/me/environment` consulta/selecciona escenario para el propio astronauta; admin sin acceso. La selección comienza ahora y no permite retrofecharla desde HTTP.

Se registraron migraciones de entorno/avisos y de trabajos de evaluación sin editar la migración original. Cada captura genera un trabajo transaccional; HTTP ejecuta `evaluatePersistedMeasurement` tras el commit. Ante fallo, la medición y su cola permanecen guardadas y la respuesta informa evaluación pendiente. `npm run assessment:retry` reprocesa hasta 100 pendientes por ejecución. Los IDs deterministas del módulo de avisos evitan duplicados. `latest` entrega evaluación actual, referencia/evidencia y antigüedad por indicador, con reglas `demo-sleep-1`, `demo-wellbeing-1` y `demo-heart-rate-1`; parámetros demostrativos en `LocalAssessmentService.ts`.

`LocalQueue` es un adaptador interno para un solo emisor por base:

- `pending(limit)`: pendientes en orden estable, máximo 500, payload persistido.
- `recordAttempt(ids)`: incrementa intentos; transporte fallido conserva pendientes.
- `confirm(id)`: confirmación individual idempotente.
- `reject(id,reason)`: rechazo visible, sin degradar un confirmado.
- `retryRejected(id)`: retorna a pendiente manteniendo payload e ID.

El emisor/receptor debe tolerar entrega repetida; no se promete entrega exactamente una vez. No hay API pública de cola; `latest` solo expone conteos/rechazos propios. El repositorio dispone de consultas internas por astronauta, indicador y período para evaluación. El emisor usa este adaptador mediante `npm run sync:send`. El receptor PostgreSQL ya está implementado. La captura ya usa revisiones reales del catálogo; su evaluación posterior y recuperación están conectadas. La prueba real de recepción PostgreSQL necesita el entorno de pruebas del equipo.

## Verificación reproducible

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:production
```

Typecheck incluye scripts/pruebas. Las pruebas usan SQLite real temporal: permisos, revocación, validación, deduplicación, rollback, contexto histórico, reapertura, cola, HTTP y contrato OpenAPI. La prueba de producción levanta Next.js con base temporal y verifica salud, Swagger/assets, login y permisos por HTTP; no toca datos reales. El receptor PostgreSQL y el ESP32 físico requieren validación conjunta posterior.

El backend de primer acceso y recuperación por preguntas ya está implementado; ver [PRIMER_ACCESO_Y_RECUPERACION.md](PRIMER_ACCESO_Y_RECUPERACION.md). La integración con el frontend sigue pendiente; no se modificaron pantallas.


Las cuentas nuevas creadas por el admin tienen `user.requiresOnboarding=true`. Deben completar `POST /api/v1/auth/onboarding` antes de capturar datos o usar sus permisos normales. El admin semilla y las cuentas existentes conservan acceso; no se generan preguntas o respuestas por defecto. Los comandos de simulación/dispositivo respetan el estado del dueño y no sustituyen el primer acceso.

## Compatibilidad de la integración remota

`GET /api/v1/me/environment` entrega el contexto `active` y la asignación histórica en `assignment`. `POST` conserva la selección explícita con revisión y `PUT` acepta `scenarioId` con la revisión vigente. Ambos requieren astronauta con primer acceso completo. La ausencia de asignación histórica sigue produciendo `ENVIRONMENT_MISSING`, sin inventar historia.

`GET /api/v1/me/alerts` y `GET/POST /api/v1/me/alerts/{id}` consultan avisos y registran acciones únicamente del astronauta autenticado. La evaluación permanece recuperable después de la captura; el resumen incluye campos de evaluación directos y el objeto `assessment` por compatibilidad. Se mantienen las reglas de `LocalAssessmentService`, sin ejecutar una segunda evaluación con parámetros distintos.
