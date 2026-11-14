# NASA Health · Tareas pendientes del MVP

Historias que faltan para cerrar la demo descrita en la [especificación](ESPECIFICACION_MVP_NASA_HEALTH.md). El acceso, la captura, el entorno histórico, la evaluación, los avisos, la cola SQLite y el receptor PostgreSQL ya están en la API. Estas historias cubren los huecos que impiden recorrer ese flujo desde el navegador, con la placa y con la base desplegada.

`/reportes` y `/configuracion` siguen reservadas. No forman parte de esta lista.

## Contrato común del frontend

Todas las historias de interfaz usan `src/frontend/src/frontend/lib/api.ts`. El cliente debe conservar el cuerpo de error `{ error: { code, message, fields } }` cuando la respuesta no es exitosa. Las mutaciones van al mismo origen, por el proxy `/api`, con `Content-Type: application/json` y `X-Nasa-Request: 1`. La cookie `nasa_session` es `httpOnly`: la pantalla decide con el JSON.

## Backend

### B1. Mostrar la misión y el módulo con su nombre

Como astronauta, quiero ver el nombre, la fase y el módulo de mi cuenta, para reconocer el contexto de la demo sin adivinar los identificadores.

La sesión ya devuelve `missionId` y `moduleId`. En la semilla son `demo-mission` y `demo-module`. Los nombres están en SQLite: «NASA Health · misión de simulación», fase «Preparación» y «Módulo de demostración». Ninguna ruta los entrega.

Criterios de aceptación:

- `GET /api/v1/auth/session`, con la cookie `nasa_session` de un astronauta, incluye `missionName`, `missionPhase` y `moduleName` leídos de las tablas `missions` y `modules`.
- Un admin recibe esos tres campos en `null`.
- La respuesta no incluye `passwordHash` ni las respuestas de seguridad.
- Si la cuenta no tiene astronauta asociado, los tres campos van en `null` y la ruta sigue respondiendo 200.

### B2. Reintentar un rechazo de sincronización

Como astronauta, quiero devolver a pendiente una medición rechazada por el receptor, para que el siguiente `npm run sync:send` la envíe otra vez con el mismo identificador.

`GET /api/v1/me/measurements/latest` ya devuelve `queue.pending`, `queue.confirmed`, `queue.rejected` y `queue.rejections` con `id` y `reason`. El reintento solo existe dentro del repositorio.

Criterios de aceptación:

- `POST /api/v1/me/sync/rejections/{measurementId}` exige sesión de astronauta, `Content-Type: application/json` y origen permitido o `X-Nasa-Request: 1`.
- Solo cambia una fila propia en estado `rejected`. La pasa a `pending`, borra el motivo y conserva el identificador y el payload.
- Responde el mismo objeto `queue` del resumen.
- Una fila ya pendiente o confirmada responde 409 sin modificarla.
- La medición de otro astronauta responde 404. Un admin recibe 403.
- La ruta no abre conexión con PostgreSQL ni usa `NASA_SYNC_DATABASE_URL`.

### B3. Iluminación simulada del módulo junto al sueño

Como astronauta, quiero consultar la iluminación simulada de mi módulo en el mismo intervalo de una noche de sueño, con hora y fuente visibles.

`telemetryAvailable` queda en `false`. El catálogo solo tiene referencias documentales fijas. No hay una serie por hora.

Criterios de aceptación:

- Existe una serie de demostración, marcada `simulated`, con valor, unidad, `capturedAt` en UTC, `moduleId` y fuente. No se presenta como telemetría de un sensor.
- `GET /api/v1/me/environment/lighting?from&to` devuelve solo las lecturas del módulo del astronauta, ordenadas por hora. El admin recibe 403.
- `from` y `to` usan el mismo formato UTC que el historial. Si `from` es posterior a `to`, responde 400 `VALIDATION`.
- Las condiciones documentales del escenario siguen en `GET /api/v1/me/environment` y no se mezclan con esta serie.
- `telemetryAvailable` permanece `false` mientras no haya una lectura real de hábitat.

### B4. Dejar el receptor PostgreSQL comprobable

Como operador de la demo, quiero un PostgreSQL aprovisionado y un receptor desplegado, para repetir un lote y comprobar una sola copia.

Criterios de aceptación:

- `node --import tsx scripts/provision-sync.mjs`, con `NASA_SYNC_DATABASE_URL` del session pooler en el puerto 5432, termina mostrando la revisión del catálogo. Ejecutarlo otra vez no cambia esa revisión.
- El servicio de `src/backend` tiene `NASA_SYNC_DATABASE_URL`, `NASA_SYNC_TOKEN` y `NASA_SYNC_MISSION_ID`.
- `POST /api/v1/sync/measurements` sin `Authorization: Bearer` responde 401. Con token incorrecto, también.
- El mismo lote, enviado dos veces, deja una fila por `measurement_id` y la segunda recepción responde `accepted`.
- Un lote con otro `missionId` responde `rejected` con `mission_forbidden` y no inserta la fila.
- En el portátil, tras `npm run sync:send`, esas mediciones pasan a `confirmed`. Si el recibo se pierde, siguen `pending`.
- En ese despliegue, `POST /api/v1/auth/login` sigue respondiendo 503 `LOCAL_ONLY`.

### B5. Comprobar el puente con la placa real

Como astronauta, quiero que una lectura del ESP32 aparezca en mi historial con origen de dispositivo, para distinguirla de una captura manual.

El puente y `POST /api/v1/measurements` ya existen. El sketch revisado solo emite CSV por USB y no define UUID ni BLE. La instalación está en [PUENTE_ESP32.md](PUENTE_ESP32.md).

Criterios de aceptación:

- Con el dispositivo aprovisionado y la cuenta de astronauta ya configurada, una línea válida del CSV crea una medición `heart_rate` en `bpm`, `origin: "device"`, `quality: "valid"` y `activity` igual a `BRIDGE_ACTIVITY`.
- Reenviar el mismo `readingId` deja una sola fila y una sola entrada de cola.
- Un estado de pérdida de señal no borra la última lectura. `GET /api/v1/me/measurements/latest` conserva su `ageSeconds` y el dispositivo informa el estado.
- El modo BLE no se usa en la demo hasta tener por escrito el UUID del servicio, el de la característica, el formato del paquete y un ejemplo válido y otro de pérdida de señal.
- Si la hora la pone el portátil, la prueba lo registra como hora de recepción. La lectura tardía queda fuera de esa pasada.

## Frontend

### F1. Iniciar sesión contra la API

Como tripulante, quiero entrar con mi usuario y contraseña reales, para llegar a mi panel o al primer acceso.

`POST /api/v1/auth/login` recibe `{ username, password }` y responde `{ user, expiresAt }`. `user.requiresOnboarding` indica el primer acceso.

Criterios de aceptación:

- Enviar el formulario llama a esa ruta y deja de usar el mapa de cuentas de ejemplo.
- Con 200 y `requiresOnboarding: false`, un astronauta va a `/dashboard` y un admin a `/usuarios`.
- Con 200 y `requiresOnboarding: true`, va al primer acceso sin abrir el panel.
- 401 `INVALID_CREDENTIALS` muestra el mensaje del servidor y conserva lo escrito en usuario.
- 429 `LOGIN_THROTTLED` muestra que debe esperar 15 minutos.
- Un fallo de red no cambia de pantalla ni guarda la contraseña en el estado visible.

### F2. Completar el primer acceso

Como usuario recién creado, quiero cambiar la contraseña inicial y guardar tres preguntas, para que el servidor habilite mi panel.

`GET /api/v1/auth/security-questions` entrega el catálogo. `POST /api/v1/auth/onboarding` recibe `{ newPassword, confirmation, answers: [{ questionId, answer }, ...] }`. Si responde `{ status: "completed", requiresLogin: true }`, la sesión anterior queda revocada. El contrato está en [PRIMER_ACCESO_Y_RECUPERACION.md](PRIMER_ACCESO_Y_RECUPERACION.md).

Criterios de aceptación:

- Hay tres listas y tres respuestas. El catálogo sale de la API, no de una copia fija.
- La contraseña se pide dos veces. Menos de 12 o más de 128 caracteres no se envía.
- El servidor responde 400 `PASSWORD_UNCHANGED` si repite la inicial, y 400 `VALIDATION` si hay preguntas repetidas, una pregunta desconocida, una respuesta vacía o confirmaciones distintas. La cuenta sigue sin entrar al panel.
- Con 200, la pantalla pide volver a `/login`. La contraseña nueva no se rellena sola.
- Recargar a mitad del formulario no marca el acceso como completado.
- 409 `ALREADY_CONFIGURED` lleva al inicio de sesión.

### F3. Recuperar la contraseña

Como usuario que olvidó su contraseña, quiero responder la pregunta que elige el servidor y definir otra, para volver a entrar sin ver mis respuestas guardadas.

`POST /api/v1/auth/recovery/start` con `{ username }` devuelve `{ challengeId, question, expiresAt, attemptsRemaining }`. `POST /api/v1/auth/recovery/verify` con `{ challengeId, answer }` devuelve `{ resetToken, expiresAt }`. `POST /api/v1/auth/recovery/reset` con `{ resetToken, newPassword, confirmation }` devuelve `{ status: "password_changed", requiresLogin: true }`.

Criterios de aceptación:

- La pregunta mostrada es la del campo `question`. El navegador no recibe ni muestra las respuestas guardadas.
- Volver atrás o recargar reutiliza el mismo `challengeId` mientras no venza. No pide otro desafío para reiniciar el contador.
- Cada 400 `RECOVERY_INVALID` muestra los intentos que quedan.
- 429 `RECOVERY_LOCKED` indica contactar al administrador y no muestra el formulario de nueva contraseña.
- 410 `CHALLENGE_EXPIRED` pide un desafío nuevo y avisa que los intentos se conservan.
- 401 `RESET_TOKEN_INVALID` cubre token ausente, vencido o reutilizado.
- Tras 200, el login con la contraseña anterior responde 401 y el login con la nueva entra.

### F4. Proteger el panel según la sesión

Como tripulante, quiero que cada ruta del panel respete mi rol y mi primer acceso, para no ver pantallas de otra persona.

`GET /api/v1/auth/session` responde `{ user, expiresAt }` o 401.

Criterios de aceptación:

- Sin sesión, `/dashboard`, `/usuarios`, `/usuarios/nuevo`, `/reportes` y `/configuracion` redirigen a `/login`.
- Con `requiresOnboarding: true`, cualquier ruta del panel redirige al primer acceso.
- Un astronauta no ve enlaces a usuarios. Entrar a `/usuarios` lo devuelve a `/dashboard`.
- Un admin no ve el tablero de salud. Entrar a `/dashboard` lo devuelve a `/usuarios`.
- Cerrar sesión llama a `POST /api/v1/auth/logout` y el siguiente `GET /api/v1/auth/session` responde 401.
- Al vencer la sesión, la siguiente llamada 401 vuelve a `/login`.

### F5. Administrar cuentas

Como admin, quiero crear, corregir e inhabilitar cuentas desde la web, para preparar la tripulación sin usar la API a mano.

`GET /api/v1/users` lista las cuentas. `POST /api/v1/users` crea con `{ username, name, password, role }`. `PATCH /api/v1/users/{id}` cambia `name`, `role`, `enabled` o `password`.

Criterios de aceptación:

- `/usuarios` muestra usuario, nombre, rol, si está habilitada y si tiene el primer acceso pendiente. No muestra hash ni contraseña.
- `/usuarios/nuevo` crea `astronauta` o `admin`. El usuario solo admite minúsculas, números, punto, guion y guion bajo, de 3 a 64 caracteres. La contraseña tiene de 12 a 128.
- Una cuenta astronauta nueva queda con `requiresOnboarding: true`, `demo-mission` y `demo-module`. La pantalla lo indica.
- 409 `USERNAME_EXISTS` señala el campo usuario.
- Inhabilitar desde la lista envía `enabled: false`. Esa cuenta deja de entrar y su sesión abierta pasa a 401.
- No se ofrece inhabilitar ni cambiar el rol del último admin habilitado. Si ocurre, se muestra 409 `LAST_ADMIN`.
- Un astronauta que llama a estas rutas recibe 403 y la pantalla no queda usable.

### F6. Desbloquear una recuperación

Como admin, quiero reactivar la recuperación de una cuenta bloqueada, para que esa persona pueda pedir otra pregunta.

`POST /api/v1/users/{id}/recovery/unlock` responde `{ status: "unlocked" }`.

Criterios de aceptación:

- La fila bloqueada tiene una acción «Desbloquear recuperación».
- Tras 200, esa persona puede pedir un desafío con tres intentos nuevos.
- La acción no cambia su contraseña ni completa su primer acceso.
- Un astronauta no ve la acción.

### F7. Completar el tablero del astronauta

Como astronauta, quiero registrar mi sueño y mi bienestar, revisar mi historial y entender el estado de la última lectura, para seguir el flujo de la demo desde `/dashboard`.

El selector de escenario y los botones de seguimiento y cierre ya llaman a la API. Hay que conservarles ese comportamiento. `POST /api/v1/me/measurements` guarda la captura. `GET /api/v1/me/measurements` lista el historial. `GET /api/v1/me/measurements/latest` trae últimos valores, evaluación, dispositivos y cola.

Criterios de aceptación:

- El encabezado muestra el nombre de la persona, el nombre de la misión, su fase y el módulo que entrega B1.
- El formulario manual ofrece sueño, en horas de 0 a 24, y bienestar, entero de 1 a 5. Envía `indicator`, `value`, `unit` (`h` o `score_1_5`), `capturedAt` en UTC y `activity`. No ofrece escribir el pulso a mano.
- Una respuesta 201 muestra la lectura nueva con origen «Manual» y su evaluación. Un 400 `VALIDATION` muestra el campo rechazado y no agrega una fila local.
- El historial filtra por indicador, desde y hasta. Pide como máximo 200 filas. Cada fila muestra valor, unidad, origen, hora y calidad.
- La evaluación de cada último valor muestra indicador, estado, `ruleVersion`, media, cantidad de muestras y antigüedad en segundos. Los estados son insuficientes, inválido, desactualizado, estable y desviación. El texto dice que la regla es de demostración.
- El pulso se considera desactualizado a los 30 segundos. Sueño y bienestar, a los 2 días. La interfaz usa el estado que devuelve el servidor.
- Si no hay sesión de astronauta, se mantiene el aviso actual y no se muestran datos de otra cuenta.

### F8. Ver el dispositivo y su antigüedad

Como astronauta, quiero ver si mi ESP32 está habilitado y cuándo comunicó por última vez, para saber si la lectura de pulso sigue vigente.

`devices` ya viene en `GET /api/v1/me/measurements/latest`. Cada dispositivo trae `id`, `enabled`, `lastCommunicationAt` y, si existe, `signal.status` y `signal.observedAt`.

Criterios de aceptación:

- La sección lista el identificador, si está habilitado y la hora de la última comunicación.
- Junto al último pulso se muestra `ageSeconds`. Si el estado de la evaluación es `stale`, se lee como lectura desactualizada.
- Si `signal.status` indica pérdida de señal, la última lectura permanece visible.
- Sin dispositivo aprovisionado, la sección indica que no hay uno vinculado y el resto del tablero sigue cargando.
- La pantalla no pide ni muestra `DEVICE_TOKEN`.

### F9. Registrar el seguimiento de un aviso

Como astronauta, quiero abrir mi aviso, anotar lo que hice y cerrarlo, para dejar constancia de la acción.

`GET /api/v1/me/alerts/{id}` devuelve `{ alert, actions }`. `POST` a esa ruta acepta `type` con valor `observation`, `repeat`, `track` o `close`, y `note` de hasta 1000 caracteres.

Criterios de aceptación:

- Cada aviso muestra motivo, versión de regla, evidencia y estado: abierto, en seguimiento o cerrado.
- Se puede guardar una observación, registrar una repetición, pasar a seguimiento y cerrar. Cada acción aparece después con autor y hora, sin recargar la página a mano.
- «Repetición» solo agrega la acción. La lectura nueva se crea con el formulario de F7.
- Una nota de más de 1000 caracteres no se envía.
- En un aviso cerrado no se ofrecen acciones. Si el servidor responde 409 `ALERT_CLOSED`, se muestra ese estado.
- El admin no tiene pantalla de avisos. Un aviso de otro astronauta responde 404.

### F10. Ver la sincronización y pedir el reintento

Como astronauta, quiero ver pendientes, confirmadas y rechazadas, para saber qué falta por llegar a PostgreSQL.

La cola ya viene en el resumen. El botón de reintento depende de B2.

Criterios de aceptación:

- Se muestran los tres conteos y, por cada rechazo, el identificador y el motivo.
- «Reintentar» llama a `POST /api/v1/me/sync/rejections/{id}` y actualiza los conteos con la respuesta.
- El botón no existe para una medición confirmada.
- El texto del botón dice que el envío ocurre al ejecutar `npm run sync:send` en el equipo local.
- Si el resumen falla, no se muestran conteos en cero como si la cola estuviera vacía.

### F11. Ver la iluminación de esa noche

Como astronauta, quiero ver la iluminación simulada al consultar una noche de sueño, para cumplir la revisión del hábitat sin confundirla con el catálogo del escenario.

Depende de B3.

Criterios de aceptación:

- Al elegir una lectura de sueño, la misma vista pide la iluminación con el `from` y el `to` de esa noche.
- Cada punto muestra valor, unidad, hora y fuente, con la etiqueta «simulada».
- Si el intervalo no tiene lecturas, se dice que no hay iluminación para ese período. El sueño sigue visible.
- Las condiciones del escenario elegido permanecen en su sección, con su fuente documental.
- No se muestra un interruptor de telemetría disponible.
