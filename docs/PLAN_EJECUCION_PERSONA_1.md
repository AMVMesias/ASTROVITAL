# NASA Health · Plan de ejecución de la persona 1

Fecha: 14 de noviembre de 2026. Estado: backend implementado; frontend excluido por instrucción posterior del usuario. Integración con persona 2 pendiente.

## 1. Base revisada y alcance

Se revisaron todos los Markdown propios encontrados en el repositorio: `AGENTS.md`, `README.md`, `REQUISITOS_NASA_HEALTH.md`, `PROPUESTA_MVP_NASA_HEALTH.md`, `ESPECIFICACION_MVP_NASA_HEALTH.md` y `PLAN_BACKEND_MVP.md`. No hay Markdown adicionales dentro de `src/frontend`. Se inspeccionaron también las vistas de login y panel, el formulario de acceso, el cliente HTTP, los componentes de portada y la configuración de dependencias.

La persona 1 entrega **acceso, administración de cuentas, persistencia local, captura, historial, simulador y adaptador de cola**, incluyendo las pantallas necesarias para usarlos. La persona 2 conserva entornos, evaluación, avisos y emisor/recepción de sincronización.

La especificación v0.7 local y el reparto de `PLAN_BACKEND_MVP.md` guían este plan. Las propuestas antiguas de NestJS, TypeORM y PostgreSQL local no sustituyen la decisión posterior: una aplicación Next.js con SQLite local y PostgreSQL para la recepción en la nube.

## 2. Estado real y diferencias documentales

| Área | Estado observado | Trabajo de persona 1 |
| --- | --- | --- |
| Backend | Solo `GET /api/health` y su caso de uso | Crear dominio, casos de uso, repositorios y adaptadores de sus módulos |
| Login | Diseño terminado; `LoginForm.tsx` solo muestra un aviso | Autenticación real, estados de envío/error, sesión y cierre |
| Panel | Layout con enlaces visibles para todos; sin comprobación de sesión | Proteger páginas y operaciones, adaptar navegación al rol |
| Usuarios | `/usuarios` y `/usuarios/nuevo` son marcadores | Listado, consulta, alta y edición administrativa |
| Dashboard | Marcador sin datos | Perfil/misión/módulo, captura manual, últimos valores, historial y dispositivo |
| Cliente HTTP | `api.ts` devuelve JSON y error HTTP genérico | Manejar errores de campo, permisos, sesión vencida y respuestas sin cuerpo |
| Persistencia | Sin SQLite, migraciones, semillas ni pruebas configuradas | Preparar infraestructura y verificaciones reproducibles |

Diferencias que deben resolverse al cerrar contratos:

- La especificación local termina en CU-10/MVP-09. El plan backend se actualizó para usar `src/backend/application/health/space_environment_surface_EVA_verified.json`, que aporta cuatro escenarios documentales y no telemetría. La ampliación ambiental aún debe reflejarse en una futura revisión de la especificación; no se presentan CU-11/MVP-10 como requisitos ya definidos.
- La escala de bienestar, reglas de validación por indicador, vigencia y parámetros del ESP32 no están cerrados. Deben quedar en una configuración versionada acordada antes de implementar sus validaciones definitivas.
- La recuperación de contraseña que aparece en el diseño no tiene servicio definido en el MVP. El cambio de credencial lo realiza el admin; el formulario no debe prometer un envío de recuperación inexistente.
- `node_modules` no está instalado. Antes de escribir código Next.js, instalar dependencias y leer las guías relevantes de `node_modules/next/dist/docs/`, como exige `AGENTS.md`. Este documento no presupone firmas de APIs del framework.

## 3. Orden de ejecución

Cada etapa termina con una entrega verificable y un commit pequeño. Se trabaja en `main` según el reparto existente, sin publicar cambios sin la autorización correspondiente de la sesión de implementación.

### Etapa 0 · Contratos y preparación

1. Instalar con `npm ci`, revisar las guías locales de Next.js y ejecutar los checks existentes para registrar el estado inicial.
2. Definir identificador de acceso, política de caducidad, campos mínimos del perfil y configuración de indicadores. Propuesta para revisar: identificador de usuario consistente con el login actual; no imponer correo sin acordarlo.
3. Acordar con persona 2 los contratos siguientes y ejemplos con admin, dos astronautas y un dispositivo. Las cuentas de astronauta de prueba se cargan solo en el escenario de demo/pruebas.
4. Documentar las rutas HTTP y errores antes de conectar las vistas. Salvo `POST /api/v1/measurements`, las rutas de este plan son propuestas.

| Contrato | Contenido mínimo | Responsable |
| --- | --- | --- |
| Sesión autorizada | Cuenta, rol, misión, astronauta cuando corresponda; cuenta habilitada y vigencia verificadas en servidor | Persona 1 |
| Medición persistida | ID estable, astronauta, indicador, valor, unidad, origen, calidad, autor/dispositivo, contexto, captura y recepción UTC | Persona 1 |
| Perfil ambiental activo | Escenario, ID/versión inmutable, ámbito por variable y asignación vigente a la hora de captura; distinguir perfil ausente de telemetría ausente | Persona 2 |
| Consulta de mediciones | Astronauta autorizado, indicador, período, orden estable y paginación | Persona 1; persona 2 valida lo necesario para evaluación |
| Cola y confirmación | ID, payload estable y versión, estado, intentos, motivo de rechazo y confirmación individual | Adaptador persona 1; emisor y receptor persona 2 |
| Evaluación posterior | Medición persistida, deduplicación por ID y forma de recuperar una evaluación fallida | Acuerdo conjunto; implementación persona 2 |

**Salida:** contratos revisables, ejemplos de petición/respuesta y decisiones pendientes registradas. Se puede avanzar con dobles de prueba del entorno, sin presentar sus datos como catálogo real.

### Etapa 1 · SQLite, migraciones y datos iniciales — tarea 1.1

1. Elegir un adaptador SQLite compatible con Node.js 22 y el runtime de servidor usado por el proyecto; registrar la decisión y sus requisitos de instalación.
2. Crear configuración exclusiva de servidor para ruta de base, secretos y modo local/nube. Mantener credenciales fuera de variables `NEXT_PUBLIC_*` y de Git.
3. Preparar migraciones ordenadas con registro de versiones y claves foráneas. Coordinar la numeración con persona 2.
4. Crear tablas propias: cuentas, perfiles de astronauta, sesiones, misión/módulo y asignaciones base, dispositivos/vínculos, indicadores, mediciones y cola. Añadir trazabilidad administrativa sin guardar contraseñas ni tokens en el registro.
5. Preparar semillas repetibles: admin inicial con hash seguro, misión, módulo e indicadores. Aprovisionar vínculo de dispositivo a un astronauta existente mediante configuración de preparación; el escenario de demo puede proporcionar ese astronauta.
6. Incorporar scripts de migración y preparación, ejemplo de variables y exclusión de archivos SQLite y sus auxiliares.

**Aceptación:** migrar una base vacía, repetir semillas sin duplicar, abrir una base ya migrada y reiniciar el servicio conservando los datos. La aplicación local no depende de Internet para abrir la base.

### Etapa 2 · Login, sesiones y permisos — tarea 1.2

1. Implementar verificación de credencial y sesión persistida revocable. Guardar contraseñas con hash seguro y evitar almacenar el token de sesión en claro.
2. Establecer cookie de sesión HttpOnly, política SameSite y Secure acorde al entorno. Definir protección de operaciones mutables frente a solicitudes de otros orígenes.
3. Comprobar cuenta habilitada, caducidad, rol y propiedad en cada operación protegida. La comprobación del layout no reemplaza la autorización del caso de uso o endpoint.
4. Conectar `LoginForm.tsx`: campos, envío, espera, error accesible y redirección por rol (`admin` a `/usuarios`; `astronauta` a `/dashboard`). Retirar el mensaje de que el prototipo no almacena datos cuando deje de ser cierto.
5. Agregar cierre de sesión y navegación según rol en `(panel)/layout.tsx`. Proteger también las rutas reservadas que permanezcan dentro del panel.

**Aceptación:** acceso correcto, error genérico para credenciales inválidas/cuenta inhabilitada, expiración y cierre efectivo. Sin sesión se deniegan operaciones; astronauta no administra cuentas y admin no consulta salud.

### Etapa 3 · Administración de usuarios — tarea 1.3

1. Implementar listar, consultar, crear y editar cuentas y perfiles básicos, solo para admin. Validar identificador único, rol y campos admitidos.
2. Crear cuenta y perfil/asignación inicial de astronauta de forma atómica cuando corresponda.
3. Implementar habilitación, inhabilitación y cambio de credencial/rol. Revocar sesiones en la misma operación al inhabilitar o cambiar rol/credencial.
4. Conservar perfiles, mediciones y autoría ante cambios de rol o inhabilitación; no eliminar registros históricos.
5. Completar `/usuarios` con listado y edición, y `/usuarios/nuevo` con formulario. Resolver la consulta/edición desde el listado antes de introducir rutas adicionales.
6. Limitar respuestas a datos administrativos: nunca hashes, tokens, valores de salud o avisos.

**Aceptación:** el admin crea un astronauta que puede iniciar sesión, modifica sus datos y revoca su acceso inmediatamente. La revocación se verifica con una sesión previamente abierta, no solo ocultando enlaces.

### Etapa 4 · Captura e historial — tarea 1.4

1. Crear un caso de uso compartido de registro para formulario, ESP32 y simulador. Cada adaptador fija las procedencias que admite; el cliente no decide libremente dueño, autor o calidad.
2. Resolver el astronauta desde la sesión para captura manual y desde el vínculo autenticado para ESP32. Verificar dispositivo habilitado, credencial y alcance; no confiar en un `astronautId` recibido.
3. Validar indicador, valor finito, escala/unidad, fechas UTC, contexto y origen. Acordar si una lectura inválida se rechaza o se conserva como evidencia de calidad; nunca incorporarla silenciosamente al cálculo.
4. Resolver la asignación ambiental aplicable a la fecha de captura y guardar escenario, ID/versión inmutable, ámbito y actividad con cada lectura. Para registros tardíos no usar automáticamente el perfil actual. Si falta perfil, devolver el error acordado; si solo falta telemetría, aceptar la captura de salud e indicar ausencia ambiental. La consulta y captura deben conservar un contexto coherente ante cambios simultáneos.
5. Guardar medición y pendiente de sincronización en una sola transacción. Aplicar unicidad por dispositivo e ID de lectura: reenvío idéntico devuelve el registro existente; mismo ID con otro contenido produce conflicto.
6. Actualizar última comunicación según la política acordada para lecturas aceptadas y reintentos idénticos, conservando por separado hora de captura y recepción.
7. Consultar último valor e historial propio por indicador y período, con límites de consulta. Entregar unidad, origen, calidad, fechas, contexto y antigüedad; persona 2 determina las reglas de vigencia y evaluación.
8. Completar la parte de `/dashboard` de persona 1: identidad y misión/módulo, formularios de sueño/bienestar, últimos valores, historial filtrable y última comunicación del dispositivo. Coordinar el archivo de página con persona 2 y componer componentes separados.

**Aceptación:** captura manual visible en historial; reintento del ESP32 sin duplicado; credencial inválida o vínculo revocado rechazados; aislamiento entre astronautas y denegación al admin. Un fallo entre escritura y cola revierte ambas. Cambiar de entorno no modifica el contexto de mediciones previas.

### Etapa 5 · Simulador y adaptador de cola — tarea 1.5

1. Preparar series sintéticas deterministas para referencia estable, variación y falta/calidad de datos. Coordinar sus valores con las reglas de persona 2.
2. Pasar cada lectura sintética por el mismo caso de uso, con origen simulado, escenario y versión visibles. Los huecos de datos se representan con ausencia de lecturas; las entradas inválidas deben seguir la política de validación acordada.
3. Proporcionar un comando local de demo reproducible, separado de semillas de producción. No crear un endpoint público para cargar datos de prueba.
4. Entregar operaciones internas para leer lotes pendientes con orden estable, registrar intentos, confirmar IDs y guardar rechazos con motivo. Un fallo de transporte conserva pendientes; un rechazo queda consultable sin marcarlo como confirmado.
5. Conservar el payload y perfil/versionado originales al reintentar. Acordar con persona 2 qué rechazos pueden reintentarse y cómo evitar envíos concurrentes inconsistentes.

**Aceptación:** el simulador cumple las mismas validaciones y transacciones; pendientes y rechazos sobreviven al reinicio; confirmar dos veces el mismo ID no altera otros registros. Persona 2 puede conectar el emisor sin acceder directamente a tablas privadas del módulo.

### Etapa 6 · Integración y entrega

1. Sustituir el doble ambiental por el proveedor real de persona 2 y comprobar captura con cambios de perfil.
2. Conectar evaluación después de persistir, con recuperación acordada si falla. Una evaluación fallida no debe causar una segunda medición al reintentar la captura.
3. Conectar cola al emisor y probar confirmaciones individuales, lote parcialmente rechazado y confirmación perdida.
4. Completar estados vacíos, errores de validación, sesión vencida y fallos de red en las pantallas. Revisar teclado y tamaños móvil/escritorio.
5. Actualizar README con arranque, migraciones, semillas, credenciales aprovisionadas, pruebas y guía del ESP32. Documentar limitaciones reales del hardware.

**Salida:** flujo local reproducible y contrato integrado con persona 2. El receptor PostgreSQL, los avisos y la evaluación se aceptan conjuntamente, sin atribuirlos a persona 1.

## 4. Rutas propuestas para cerrar en la etapa 0

| Operación | Ruta propuesta | Acceso |
| --- | --- | --- |
| Login / logout | `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` | Credenciales / sesión |
| Identidad actual | `GET /api/v1/auth/session` | Sesión vigente |
| Listar / crear cuentas | `GET /api/v1/users`, `POST /api/v1/users` | Admin |
| Consultar / editar cuenta | `GET /api/v1/users/:id`, `PATCH /api/v1/users/:id` | Admin |
| Captura manual | `POST /api/v1/me/measurements` | Astronauta; dueño desde sesión |
| Historial / últimos valores | `GET /api/v1/me/measurements`, `GET /api/v1/me/measurements/latest` | Astronauta; solo propios |
| Dispositivo propio | `GET /api/v1/me/device` | Astronauta |
| Ingesta ESP32 | `POST /api/v1/measurements` | Credencial y vínculo de dispositivo |

Definir errores estables para validación, falta de sesión, permiso denegado y conflicto. Las respuestas de captura deben distinguir creación y reenvío idéntico. La cola se expone a persona 2 mediante un contrato interno; no necesita una API pública para cumplir este reparto.

## 5. Organización de archivos y coordinación

Mantener `src/app` como adaptador fino y `src/frontend/features` como lugar de los componentes funcionales. Propuesta de módulos backend dentro de las capas actuales: `auth`, `users`, `devices`, `measurements` y `sync-queue`; repositorios SQLite en infraestructura y contratos independientes del transporte en aplicación/dominio.

Persona 1 coordina `package.json`, lockfile, configuración de base, registro de migraciones, `.env.example`, cliente HTTP y layout compartido. Persona 2 entrega sus migraciones y componentes para integrarlos de forma explícita. En el dashboard, persona 1 mantiene captura/historial y persona 2 entorno/evaluación/avisos.

Antes de publicar cada commit: revisar `git diff`, preparar solo archivos propios, actualizar desde `origin/main` con árbol limpio y ejecutar checks aplicables. Evitar incluir bases, secretos o datos personales. No reiniciar ni borrar una base compartida para reproducir escenarios; usar archivos exclusivos de pruebas/demo.

## 6. Pruebas y criterio de finalización

Las pruebas automatizadas deben cubrir invariantes del servidor y transacciones, usando SQLite temporal real donde corresponda:

- Login válido/inválido, logout, caducidad y revocación por estado/rol/credencial.
- Astronauta A no administra cuentas ni consulta datos de B; admin no lee salud. Probar solicitudes directas además de navegación.
- Alta de usuario atómica, identificador duplicado, respuesta administrativa sin secretos ni salud.
- Captura con validación, dueño resuelto en servidor, origen preservado, perfil/versionado histórico y fechas UTC.
- Ingesta con dispositivo inválido/revocado, reenvío idéntico y colisión de ID.
- Rollback conjunto de medición y cola; persistencia tras reabrir la base; confirmación individual e idempotente.
- Migración desde cero y sobre base ya migrada; semillas repetidas sin duplicados.

Verificación manual final:

1. Con Internet desconectado y red local activa, iniciar como admin, crear astronauta e iniciar con esa cuenta.
2. Registrar sueño/bienestar, consultar historial y enviar lectura autenticada de ESP32 o cliente de prueba identificado. Repetir con hardware físico cuando esté disponible.
3. Reiniciar el servicio y comprobar persistencia. Cortar el sensor y verificar que se conserva el último valor y se muestra su antigüedad.
4. Inhabilitar una cuenta y comprobar que su sesión abierta deja de funcionar.
5. Con persona 2, recuperar Internet, reenviar lote tras confirmación perdida y verificar una copia por ID en PostgreSQL y estados correctos en SQLite.
6. Ejecutar `npm run lint`, `npm run typecheck`, `npm run build` y el comando de pruebas que se incorpore. Verificar que la configuración de nube no intenta usar SQLite persistente en Vercel.

La persona 1 termina cuando las cinco tareas de su reparto tienen evidencia reproducible, las pantallas correspondientes funcionan con datos persistidos y persona 2 puede consumir sesión, mediciones y cola mediante los contratos acordados. No se fijan días de entrega sin conocer disponibilidad; cada etapa constituye un hito y depende de la anterior, mientras persona 2 puede avanzar con los contratos de la etapa 0.

## 7. Ajuste de ejecución por el catálogo ambiental incorporado

Base: [JSON ambiental](../data/space_environment_surface_EVA_verified.json) y [análisis de integración](ANALISIS_CATALOGO_AMBIENTAL.md). El JSON tiene versión de esquema 1.1.0; esa versión no reemplaza la versión de contenido que se guardará con cada perfil.

| Hito existente | Trabajo adicional de persona 1 | Dependencia de persona 2 |
| --- | --- | --- |
| Etapa 0 · Contratos | Acordar cuatro escenarios, actividad, asignación temporal, versión/checksum y respuesta por ausencia | Adaptador de referencias y perfil ambiental; no consumir el JSON desde el formulario |
| Etapa 1 · Persistencia | Coordinar migración de claves hacia perfiles inmutables y persistencia del contexto en medición/cola | Tablas ambientales, semillas y catálogo validados |
| Etapa 4 · Captura/historial | Resolver contexto histórico en captura manual, ESP32 y simulador; mostrar referencia ambiental en bloque separado | Consulta de perfil válida a una fecha y DTO de ficha/observaciones |
| Etapa 5 · Simulador | Mantener fixtures fisiológicos sintéticos separados; no muestrear rangos publicados como datos reales ni rellenar `null` | Iluminación sintética y eventuales reproducciones históricas etiquetadas |
| Etapa 6 · Integración | Verificar captura offline y preservación de versión al sincronizar, incluso con cambio de perfil y lecturas tardías | Mismas versiones provisionadas en PostgreSQL antes de recepción |

Los cuatro IDs de escenario son `deep_space_transit`, `iss_leo`, `moon_surface` y `mars_surface`. Los dos últimos describen exterior de superficie durante EVA. No crear perfiles de cabina lunar/marciana utilizando esos valores. La asignación ambiental tampoco demuestra exposición interna ni causalidad sobre el pulso.

Añadir a las pruebas de integración: perfil inexistente rechazado explícitamente; perfil existente sin telemetría permite captura; lectura antigua conserva contexto de captura; versión posterior no cambia historial; conflicto de contenido para una misma versión se rechaza; nube con versión desconocida devuelve rechazo individual recuperable. Verificar que las referencias de radiación del detector no se guardan como dosis del astronauta y que solo se comparan indicadores/contextos compatibles.

La ubicación actual del JSON bajo `application/health` no obliga a importar datos científicos en el caso de uso `getHealth`. Mantener el endpoint de disponibilidad independiente del catálogo; persona 2 encapsula lectura/validación en un adaptador de infraestructura ambiental. La reubicación física del original se decide al implementar y conserva trazabilidad.


## 8. Estado de la entrega de backend

Por instrucción posterior del usuario, la ejecución se limitó al servidor. Los pasos de integración de login, panel, usuarios y dashboard del frontend no se ejecutan en esta entrega; no hay protección de páginas añadida. Los endpoints y casos de uso sí verifican sesiones, rol y propiedad.

Implementados: migraciones y semillas SQLite; contraseñas scrypt y sesiones revocables; administración de cuentas; captura manual y ESP32; deduplicación; historial y últimos valores propios; procedencia y contexto ambiental por contrato; persistencia transaccional de medición/cola; simulador local y adaptador de pendientes/confirmaciones/rechazos. Swagger/OpenAPI se entrega en `/api/docs` y `/api/openapi`.

La composición acepta un `EnvironmentProvider` reemplazable; el adaptador actual es explícitamente provisional y no implementa asignaciones históricas reales ni el catálogo de cuatro escenarios. Evaluación, avisos, telemetría ambiental y receptor PostgreSQL siguen bajo persona 2. El ESP32 físico y la pérdida real de conectividad requieren prueba conjunta; las pruebas actuales usan SQLite real, dispositivos de prueba y fuentes locales.

La configuración de formato de demo define bienestar entero de 1 a 5; sueño 0–24 h y pulso 1–300 bpm como validación de entrada, no reglas clínicas. Documentación reproducible, decisiones y comandos en [BACKEND_PERSONA_1.md](BACKEND_PERSONA_1.md). El catálogo documental está actualmente en `data/space_environment_surface_EVA_verified.json`; las referencias a su ubicación anterior en este plan describen la revisión inicial.
