# NASA Health · Plan de trabajo del backend para dos personas

Este plan toma la [especificación v0.7 local](ESPECIFICACION_MVP_NASA_HEALTH.md) para cuentas y avisos, e incorpora el catálogo documental [space_environment_surface_EVA_verified.json](../data/space_environment_surface_EVA_verified.json). La selección de cuatro escenarios es una ampliación de planificación: CU-11 y MVP-10 no están definidos en la especificación local y no se usan aquí como requisitos aprobados. El repositorio tiene vistas iniciales y `GET /api/health`. Ambas personas desarrollan en **main**.

El admin gestiona cuentas y perfiles básicos desde la web. El astronauta registra y consulta sus propias mediciones, atiende sus avisos y los cierra. El acceso del admin a operaciones de salud y el acceso del astronauta a la administración de cuentas se deniegan en el servidor.

## Persona 1 · Acceso, usuarios y captura local

| Tarea | Entrega concreta | Referencia |
| --- | --- | --- |
| **1.1 · SQLite y datos iniciales** | Implementar el arranque, la configuración y el orden de migraciones de SQLite. Cargar el admin inicial, la misión, el módulo y el vínculo inicial del ESP32. Coordinar los archivos compartidos de configuración, scripts npm y lockfile. | CU-09, MVP-02, MVP-08 |
| **1.2 · Login y sesiones** | Implementar inicio y cierre de sesión, comprobación de vigencia y cuenta habilitada, y permisos de servidor para `astronauta` y `admin`. Conectar el backend de `/login` y las restricciones del panel. | CU-01, MVP-01 |
| **1.3 · Gestión de usuarios** | Conectar `/usuarios` y `/usuarios/nuevo` con listar, consultar, crear y editar cuentas y perfiles básicos. Permitir cambiar rol o credencial, habilitar e inhabilitar. Invalidar las sesiones vigentes al inhabilitar o cambiar rol o credencial. Conservar autoría e historial y entregar solo datos administrativos. | CU-07, MVP-01, RF-06, RF-07 |
| **1.4 · Captura e historial** | Implementar registro manual de sueño y bienestar, `POST /api/v1/measurements` para ESP32 y consulta del último valor e historial propio. Resolver el astronauta mediante sesión o dispositivo autenticado. Validar unidad, fecha y origen. Guardar con la lectura el escenario, ámbito, versión inmutable del perfil y período de asignación aplicable a la hora de captura. Mantener las referencias documentales separadas de telemetría y biometría; ausencia ambiental no impide capturar salud si existe un perfil válido. Deduplicar por dispositivo e ID de lectura, y registrar medición y pendiente de sincronización en una transacción SQLite. Exponer la última comunicación del dispositivo. | CU-02, CU-03, CU-09, MVP-03, MVP-08; ampliación ambiental de este plan |
| **1.5 · Simulador y cola local** | Pasar las series de prueba por el caso de uso de captura y marcarlas como simuladas. Implementar el acceso a la cola SQLite para leer pendientes y registrar confirmaciones o rechazos por ID. | CU-08, CU-10, MVP-03, MVP-09 |

**Archivos a cargo.** Módulos de aplicación, dominio e infraestructura para autenticación, usuarios, dispositivos, mediciones y cola SQLite. Adaptadores de login, gestión de usuarios, captura e historial. Migraciones de esas tablas y configuración compartida.

**Pruebas propias.** Login correcto, inválido e inhabilitado. Crear y editar cuentas con el admin y comprobar revocación de sesión. Verificar que un astronauta no administra cuentas ni lee el historial de otro, y que el admin no consulta mediciones. Probar credenciales del ESP32, deduplicación, persistencia tras reinicio y guardado conjunto de la medición y su pendiente. Usar una consulta de perfil ambiental de prueba hasta conectar el módulo de la persona 2.

## Persona 2 · Entornos, evaluación, avisos y sincronización

| Tarea | Entrega concreta | Referencia |
| --- | --- | --- |
| **2.1 · Catálogo y selector** | Validar y adaptar los cuatro escenarios del JSON documental: `deep_space_transit`, `iss_leo`, `moon_surface`, `mars_surface`. Sembrar referencias y perfiles versionados en SQLite y provisionar las versiones aceptadas en PostgreSQL. Exponer selector y ficha con ámbito, fuente, rango/promedio e incertidumbre; mostrar ausencia de telemetría. Mantener la asignación histórica del astronauta. Preparar importación offline de un lote EDA y uno MEDA tras validar archivos y unidades. La iluminación sintética se carga aparte, etiquetada por módulo y período. | CU-05, MVP-05; ampliación ambiental de este plan |
| **2.2 · Evaluación** | Implementar referencia individual, mínimo de muestras, comparabilidad de las lecturas y vigencia según indicador. Entregar al tablero el estado, los motivos, la evidencia y la versión de la regla demostrativa. Distinguir datos insuficientes, avisos de calidad y desviaciones. | CU-04, MVP-04, MVP-06 |
| **2.3 · Acciones y cierre** | Implementar listado y detalle de avisos propios. Registrar repetición u observación y transiciones de abierto a en seguimiento o cerrado, con autor, fecha y evidencia conservada. Usar la sesión de astronauta y verificar propiedad en el servidor. Mantener avisos y acciones en SQLite. | CU-06, MVP-07 |
| **2.4 · Sincronización** | Implementar el emisor que consume la cola local y la recepción HTTPS en Vercel. Validar la credencial del equipo, el alcance y la versión de perfil. Guardar en PostgreSQL con unicidad por ID, devolver confirmación por registro y exponer el estado y el reintento manual de la demo. Confirmar un reenvío idéntico y rechazar un ID reutilizado con otro contenido. | CU-10, MVP-09; contrato ambiental versionado |

**Archivos a cargo.** Módulos de aplicación, dominio e infraestructura para entorno, evaluación, avisos y sincronización. Adaptadores de consulta ambiental, avisos y sincronización. Migraciones de las tablas de esos módulos en SQLite y de recepción en PostgreSQL.

**Pruebas propias.** Cargar el catálogo dos veces y verificar cuatro escenarios sin duplicados. Rechazar fuentes inexistentes y unidades incompatibles; conservar rangos y `null`. Verificar que una referencia no aparece como lectura actual ni entra al cálculo fisiológico. Simular el cambio de perfil y comprobar que el historial conserva el perfil anterior. Probar serie estable, datos insuficientes, desviación y último dato desactualizado. Verificar seguimiento y cierre por el dueño, acceso denegado para otro astronauta y el admin. Simular una confirmación perdida, un reenvío idéntico y una colisión de ID. Usar sesiones, mediciones y cola de prueba mientras la persona 1 construye los adaptadores reales.

## Contratos y secuencia en main

1. **Acordar los contratos en un primer commit compartido.** La persona 1 prepara los contratos de sesión y medición. La persona 2 propone los de entorno, consulta para evaluación y confirmación de sincronización. Incluir ejemplos reproducibles con dos astronautas de prueba, un admin, un dispositivo y los cuatro escenarios con versiones explícitas. Cualquiera puede comenzar con sus datos de prueba mientras se cierra el commit.
2. **Implementar en paralelo.** Cada persona trabaja en su copia local de `main` y usa su propio archivo SQLite. Coordinen el archivo de migraciones, `package.json`, el lockfile y los adaptadores compartidos con el frontend. La persona 1 mantiene esos archivos comunes. Cada una prepara únicamente sus archivos para el commit.
3. **Publicar commits pequeños en el mismo main.** Antes de hacer push, actualizar los commits locales sobre `origin/main` con `git pull --rebase` cuando el árbol esté limpio y ejecutar los checks de los módulos tocados. Si dos pushes coinciden y Git rechaza el segundo, traer el primero, resolver cualquier conflicto con su responsable, verificar y repetir el push.
4. **Integrar por puntos concretos.** Primero conectar la selección ambiental con captura. Después invocar la evaluación tras persistir una lectura válida. Acordar cómo reprocesar una evaluación fallida y deduplicar avisos de una misma lectura. Por último, conectar el emisor de la persona 2 al adaptador SQLite de cola de la persona 1.

| Punto de integración | Acuerdo mínimo |
| --- | --- |
| Sesión → módulos | ID de cuenta, rol, ámbito de misión e ID de astronauta cuando corresponda. Cuenta habilitada y sesión vigente comprobadas en servidor. |
| Entorno → captura | Escenario, ID/versión inmutable de perfil, ámbito y asignación válida para la hora de captura. Mantener intervalos sin solapamiento y cambios concurrentes coherentes. Separar ausencia de perfil de ausencia de telemetría. El historial y el lote conservan el mismo contexto. |
| Captura → evaluación | Medición persistida con ID estable, dueño, indicador, valor, unidad, origen, calidad, contexto y horas UTC. Consulta por astronauta, indicador y período. |
| Cola → nube | Lote con IDs estables y confirmación individual. Un fallo de transporte conserva los pendientes y un rechazo queda visible con su motivo. |

## Verificación conjunta

1. Con la red local activa e Internet cortado, iniciar sesión como admin, crear un astronauta y entrar con esa cuenta. Elegir cabina y registrar sueño. Cambiar a un perfil EVA, guardar pulso de prueba y confirmar que cada medición conserva el perfil capturado.
2. Generar un aviso con una serie de demo. El propio astronauta registra seguimiento y cierra el aviso. Verificar que el admin puede gestionar la cuenta y que el servidor le deniega el acceso a mediciones y avisos. Inhabilitar una cuenta de prueba y validar que su sesión previa y su nuevo login quedan bloqueados.
3. Reiniciar Next.js local. Comprobar la persistencia en SQLite, recuperar Internet y enviar dos veces el mismo lote. PostgreSQL conserva una copia por medición y la cola confirma cada ID. Repetir la captura con el ESP32 físico y comprobar la antigüedad de la última lectura al cortar el sensor.
4. Ejecutar `npm run lint`, `npm run typecheck`, `npm run build` y las pruebas automatizadas implementadas. Verificar las migraciones desde SQLite vacío y contra una base anteriormente migrada, y la recepción en PostgreSQL de pruebas.

## Incorporación del JSON ambiental · Secuencia concreta

El análisis y los criterios se detallan en [ANALISIS_CATALOGO_AMBIENTAL.md](ANALISIS_CATALOGO_AMBIENTAL.md). El archivo original se conserva como evidencia; no se importa como mediciones personales ni se ejecutan sus URLs automáticamente.

1. **Persona 2, antes del catálogo:** definir esquema de validación, normalización de unidades, identificadores y mapeo de ámbitos por variable. Separar `schema_version` (formato) de versión de contenido/perfil y checksum. Documentar la referencia Orion como misión lunar de comparación, no como crucero a Marte medido.
2. **Ambas personas, contrato compartido:** acordar referencias, perfiles, asignaciones temporales y observaciones como recursos distintos. Persona 1 prepara claves/contrato de captura; persona 2 prepara repositorio ambiental y semillas. Una lectura tardía usa el contexto de su captura; si no se puede resolver, se informa y no se le asigna silenciosamente el entorno actual.
3. **Persona 2, entrega mínima offline:** validar el JSON, sembrar sus cuatro escenarios y fuentes, mostrar fichas sin telemetría inventada y habilitar selector. Los perfiles lunares/marcianos son de exterior durante EVA, no interiores de estaciones. Nuevos hábitats requieren perfiles separados y evidencia o supuestos etiquetados.
4. **Persona 1, entrega mínima de captura:** enlazar perfil/versionado y actividad (reposo, ejercicio o EVA) con medición y cola en la misma transacción; mostrar procedencia. No fabricar valores personales a partir del catálogo.
5. **Persona 2, datos históricos:** verificar URL, formato, permisos de uso, unidad, instrumento y calidad de EDA/MEDA; descargar un lote pequeño, conservar original/checksum y registrar transformaciones. Priorizar exportación manual reproducible; no depender de APIs remotas para arrancar la demo. Diviner y archivos radiológicos quedan como siguiente entrega. DONKI y OLTARIS quedan para exploración posterior.
6. **Integración:** provisionar las mismas versiones en nube antes de enviar mediciones que las referencien. Si falta una versión en recepción, rechazar ese registro con motivo visible y mantenerlo recuperable. La cola del MVP sigue enviando mediciones personales; importar telemetría ambiental no implica sincronizarla por esa cola.
7. **Aceptación conjunta:** capturar en los cuatro escenarios sin Internet; mantener `null` como ausencia; cambiar perfil y recibir después una lectura antigua sin reasignarla al nuevo; repetir semillas/importaciones; reiniciar y sincronizar sin perder versión. Verificar etiquetas de referencia histórica frente a telemetría y datos sintéticos. El cálculo personal compara solo lecturas válidas y contextos compatibles.
