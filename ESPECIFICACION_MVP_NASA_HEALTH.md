# NASA Health · Especificación del MVP

| Campo | Valor |
| --- | --- |
| Versión | 0.6 |
| Estado | Referencia de implementación para revisión del equipo |
| Fecha | 14 de noviembre de 2026 |
| Documentos de origen | [Requisitos v0.2](REQUISITOS_NASA_HEALTH.md) y [propuesta de MVP](PROPUESTA_MVP_NASA_HEALTH.md) |
| Base implementada | Next.js por capas, portada y endpoint de salud |
| Producción | [NASA Health en Vercel](https://nasa-health-olive.vercel.app/) · [Estado de la API](https://nasa-health-olive.vercel.app/api/health) |

## 1. Objetivo y definición de éxito

NASA Health es un prototipo web para que un astronauta pueda **recopilar indicadores de salud, evaluar cambios y actuar durante una misión**. El flujo reúne lecturas de sensores, registros manuales y contexto ambiental. Cada aviso explica por qué apareció y permite registrar una acción. [Reto oficial de NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) · [Objetivos ampliados publicados por HackAthlone](https://hackathlone.com/challenges/health-monitoring-software#objectives)

El criterio de éxito de la demo es que la tripulación complete ese flujo desde el inicio de sesión hasta el seguimiento del aviso. La orientación es demostrativa e incluye verificar el dato, repetir una medición, anotar contexto y solicitar revisión. Si el equipo dispone de un protocolo revisado para el escenario, el aviso puede abrirlo como material de consulta. La validación clínica, el diagnóstico, el tratamiento automatizado y el uso operativo en vuelo quedan fuera del MVP.

## 2. Modelo de negocio y operación

| Elemento | Definición |
| --- | --- |
| Usuario principal | Astronauta que registra indicadores, evalúa su evolución y atiende avisos. |
| Usuario secundario | Admin que revisa los casos derivados y registra su resolución. |
| Organización usuaria | Operador de misión o equipo de simulación. El admin prepara el escenario, asigna dispositivos y define los protocolos disponibles. |
| Propuesta de valor | Consultar en un solo lugar qué cambió, en qué contexto ocurrió y qué hizo la tripulación. |
| Operación | Cuentas, misión y módulo precargados. Cada astronauta accede a sus registros. El admin accede a los casos derivados de la misión asignada. |
| Éxito del prototipo | Completar el guion de aceptación con un usuario que pueda explicar el aviso, registrar el seguimiento y localizar la evidencia. |

El MVP valida la utilidad del flujo para la tripulación. La comercialización, los precios y la contratación quedan para una etapa posterior.

## 3. Alcance

| Capacidad | Entrega del MVP |
| --- | --- |
| Acceso | Inicio y cierre de sesión, cuentas de demo precargadas, protección de páginas y operaciones de servidor, permisos por rol. |
| Escenario | Una misión y un módulo precargados. Se propone un hábitat simulado en Marte. |
| Captura personal | Horas de sueño y bienestar por formulario, y frecuencia cardíaca en reposo por ESP32. El simulador usa el mismo flujo de registro y facilita una demo reproducible mientras se verifica el hardware. |
| Tablero | Último valor, unidad, antigüedad, origen, calidad, referencia personal e historial por indicador y período. |
| Contexto ambiental | Ficha de destino y telemetría de iluminación simulada del módulo junto al historial de sueño. El modelo admite temperatura y presión de cabina, oxígeno, CO₂ y humedad. |
| Avisos | Avisos de calidad y de variación demostrativa, con explicación, orientación operativa, acción registrada y revisión de los casos derivados. |
| Continuidad | Next.js con SQLite en el equipo local para operar sin Internet. Next.js en Vercel con PostgreSQL consolida las mediciones al recuperar conexión. La instalación como PWA y el almacenamiento en IndexedDB quedan fuera del MVP. |

Las vistas iniciales son inicio de sesión, tablero con captura e historial, detalle de aviso y una lista sencilla de casos derivados para la segunda cuenta. La administración avanzada, el registro público, las exportaciones, la gestión de múltiples misiones, la sincronización con Tierra y la gamificación quedan para fases posteriores.

## 4. Actores y casos de uso

| ID | Caso y actor | Flujo principal | Alternativa o resultado |
| --- | --- | --- | --- |
| CU-01 | Iniciar y cerrar sesión · astronauta y admin | La persona entra con una cuenta precargada y accede a la vista de su rol. Puede cerrar la sesión. | Con credenciales incorrectas se muestra un error. Sin sesión o permiso se deniega el acceso. |
| CU-02 | Recibir medición · ESP32 | El dispositivo se autentica y envía una lectura. El servidor valida los datos, identifica al astronauta asignado y guarda la lectura. | Si se reenvía la misma lectura, se guarda una sola vez. Los datos inválidos quedan fuera del cálculo de tendencias. |
| CU-03 | Registrar dato manual · astronauta | Selecciona el indicador, registra valor y momento, y añade contexto si corresponde. | El error de validación explica qué campo corregir. El registro aceptado aparece en el historial con origen manual. |
| CU-04 | Evaluar un cambio · astronauta | Consulta la tendencia frente a su referencia individual y revisa el origen, calidad y antigüedad del dato. | Si faltan lecturas comparables, se muestra «Datos insuficientes». Si la última lectura quedó desactualizada, se indica su antigüedad. |
| CU-05 | Consultar el entorno · astronauta | Revisa el destino, la fase y el módulo. En el historial de sueño, consulta la iluminación del módulo durante el período seleccionado. | Si falta telemetría, se muestra la ausencia de datos. Las coincidencias en el tiempo se presentan como contexto. |
| CU-06 | Atender aviso · astronauta | Abre el aviso, lee el motivo y registra una repetición, una observación o la solicitud de revisión. | La acción queda asociada al aviso con autor y fecha. Si solicita revisión, el caso aparece en la lista del admin. |
| CU-07 | Revisar caso · admin | Consulta la evidencia y las acciones previas, registra su evaluación y cierra el caso. | Se conserva el historial de acciones. |
| CU-08 | Ejecutar escenario · equipo de demo | Carga una serie sintética reproducible para demostrar variación, falta de datos y el seguimiento. | Los registros se identifican como simulados en el tablero y el historial. |
| CU-09 | Operar sin Internet · astronauta y ESP32 | Con la red local activa, el astronauta inicia sesión, registra datos y consulta el historial. El ESP32 sigue enviando lecturas a Next.js local. | SQLite conserva las lecturas tras reiniciar el servicio. Si se pierde acceso al equipo local, la captura web se reanuda al recuperar ese enlace. |
| CU-10 | Sincronizar mediciones · equipo local | Al recuperar Internet, Next.js local envía los registros pendientes a la API en Vercel y recibe una confirmación por registro. | Los errores transitorios permiten reenviar los mismos IDs. Los rechazos se muestran con su motivo. |

## 5. Requisitos trazables y criterios de aceptación

Los IDs de esta tabla organizan la implementación del MVP. La última columna remite a los requisitos originales que desarrolla cada fila.

| ID | Requisito del MVP | Evidencia de aceptación | Referencia v0.2 |
| --- | --- | --- | --- |
| MVP-01 | Autenticación y autorización por rol. | Inicio y cierre exitosos. Una cuenta sin permiso queda bloqueada en páginas y operaciones protegidas. | RF-01 a RF-05, RF-07, RNF-01 a RNF-04 |
| MVP-02 | Identificar astronauta, misión, fase y módulo en el tablero. | La cuenta de demo muestra su perfil y el contexto precargado. | RF-08 a RF-13 |
| MVP-03 | Capturar lecturas manuales, simuladas y de dispositivo con procedencia explícita. | El historial conserva unidad, origen, autor o dispositivo, fecha de captura y estado de calidad. | RF-14 a RF-25, RF-26 a RF-30, RF-37 a RF-40, RNF-05, RNF-06, RNF-14, RH-01 a RH-08 |
| MVP-04 | Comparar lecturas válidas con una referencia personal y mostrar historial. | El tablero explica el período de referencia y el cambio. Una serie insuficiente produce el estado correspondiente. | RF-20 a RF-30, RF-41, RF-42 |
| MVP-05 | Mostrar contexto ambiental por ubicación y tiempo. | Una noche de sueño se puede consultar junto a la iluminación de su módulo, con fuente y hora visibles. | Extiende RF-23 a RF-25 y el modelo de datos v0.2 |
| MVP-06 | Distinguir aviso de calidad de aviso por variación. | Una lectura inválida o ausente y una variación sostenida producen indicadores de estado distintos. El aviso muestra su motivo. | RF-19, RF-31 a RF-36, RF-42, RF-43, RNF-07, RNF-08, RNF-15 |
| MVP-07 | Registrar acciones y resolver casos derivados. | La cuenta del astronauta solicita revisión y la del admin registra una acción y cierra el caso. | Extiende RF-33 a RF-36 |
| MVP-08 | Operar en la red local con Next.js y SQLite. | Con Internet desconectado funcionan login, formulario, historial e ingesta del ESP32. Reiniciar el servicio conserva los registros. Al cortar el sensor se conserva la última lectura y se indica su antigüedad. | RNF-07 a RNF-13, RH-07, RH-08 |
| MVP-09 | Sincronizar mediciones nuevas con PostgreSQL. | Al restablecer Internet, enviar los pendientes y repetir el mismo lote. Confirmar una sola copia por ID en la nube y el estado sincronizado en el equipo local. | Extiende RF-26 a RF-30 y RNF-05 a RNF-08 |

### 5.1 Operaciones CRUD y permisos

**Demo** se implementa en el flujo del MVP. **Preparación** se resuelve con datos iniciales o configuración controlada por el admin. **Posterior** queda en el backlog. En esta matriz, retirar puede significar desactivar, desvincular, archivar o revocar, según el recurso. Los únicos roles de la aplicación son astronauta y admin. El admin prepara las cuentas y los datos de demo mediante configuración y revisa los casos derivados de su misión. Las tareas de preparación pueden ejecutarse fuera de la interfaz web.

| Recurso y trazabilidad | Crear | Consultar | Actualizar | Retirar |
| --- | --- | --- | --- | --- |
| Cuentas y roles · RF-06, RF-07 | Preparación · aprovisionar cuentas con credenciales hasheadas y rol asignado. | Demo · consultar identidad y rol propios. Posterior · listar cuentas para administración. | Preparación · cambiar credencial o rol mediante el admin. Posterior · gestión desde la web. | Preparación · desactivar cuenta e invalidar sus sesiones. Conservar autoría e historial. |
| Sesiones · CU-01, RF-01 a RF-05 | Demo · autenticar credenciales y abrir sesión local. | Demo · comprobar vigencia, cuenta activa y permisos en el servidor. | Demo · aplicar caducidad de sesión. Los cambios de credenciales o permisos requieren una sesión nueva. | Demo · cerrar sesión e invalidarla. |
| Perfiles · RF-08 a RF-10, RF-13 | Preparación · crear astronauta y vincular su cuenta. | Demo · el astronauta ve su perfil. El admin accede al contexto del perfil en casos derivados de su misión. | Preparación · corregir datos del perfil. Posterior · edición y listado administrativo en la web. | Posterior · archivar perfil conservando mediciones y acciones. |
| Misiones, módulos, destino y asignaciones · RF-11, RF-12, MVP-02, MVP-05 | Preparación · cargar misión, fase, módulo, destino y asignaciones. | Demo · consultar el contexto autorizado y la ficha del destino. | Preparación · configurar la misión de demo. Posterior · administrar fases y asignaciones desde la web. | Posterior · cerrar o archivar y conservar el contexto histórico. |
| Dispositivos, sensores y vínculos · RF-14 a RF-19, RF-43 | Preparación · registrar ESP32, sensor y vínculo con el astronauta. | Demo · consultar origen, estado y última comunicación del dispositivo asociado. | Preparación · reasignar o rotar la credencial. Demo · actualizar la última comunicación al recibir una lectura aceptada. | Preparación · desvincular o revocar el dispositivo y conservar la procedencia histórica. |
| Catálogo de indicadores y reglas · RF-20 a RF-25, RF-31 a RF-36 | Preparación · cargar indicadores, unidades, escalas y reglas versionadas. | Demo · mostrar los disponibles y explicar la regla de cada aviso. | Preparación · publicar una versión nueva conservando la aplicada a avisos anteriores. | Posterior · desactivar para nuevas mediciones preservando el historial. |
| Mediciones personales · CU-02 a CU-04, RF-15, RF-20 a RF-30 | Demo · el astronauta registra manualmente. El ESP32 y el simulador envían lecturas con su procedencia. | Demo · consultar último valor e historial filtrado por indicador y período, dentro del acceso autorizado. | Demo · el sistema actualiza vigencia y sincronización. Posterior · correcciones trazables de valores. Una repetición crea otra lectura. | Posterior · aplicar política de retención. |
| Lecturas ambientales · CU-05, MVP-05 | Demo · cargar iluminación simulada por módulo y hora. | Demo · consultar ambiente y sueño en el mismo período. | Preparación · ajustar la configuración del escenario. La siguiente observación se guarda como lectura nueva. | Posterior · aplicar retención manteniendo la trazabilidad del escenario. |
| Referencia individual · CU-04, MVP-04 | Demo · calcular referencia con lecturas válidas y comparables. | Demo · consultar valor, período, cantidad de muestras y contexto. | Demo · recalcular según la regla configurada y conservar la evidencia usada en cada aviso. | Posterior · gestionar referencias históricas. |
| Avisos · CU-06, CU-07, RF-31 a RF-36 | Demo · el sistema genera un aviso por calidad o por variación. | Demo · listar avisos propios y, para el admin, casos derivados de su misión. | Demo · solicitar revisión, registrar seguimiento y cerrar el caso con el rol autorizado. | Posterior · archivar según la política de retención. |
| Acciones de seguimiento · CU-06, CU-07 | Demo · registrar repetición, nota, derivación o revisión con autor y fecha. | Demo · consultar las acciones desde el aviso autorizado. | Demo · anexar una acción nueva para ampliar o corregir una observación. | Posterior · aplicar retención de auditoría. |
| Escenarios de simulación · CU-08, RF-37 a RF-40 | Preparación · definir series sintéticas. Demo · ejecutar un escenario y generar lecturas etiquetadas. | Demo · identificar escenario y origen simulado en el historial. | Preparación · versionar escenarios. | Preparación · reiniciar el entorno de demo con datos ficticios. |
| Cola de sincronización · CU-10, MVP-09 | Demo · generar un pendiente por medición local en la misma transacción. | Demo · consultar pendientes, confirmaciones y rechazos. | Demo · enviar, reintentar con el mismo ID y registrar la confirmación de PostgreSQL. | Posterior · depurar registros confirmados según retención. |
| Tablero, reportes y exportación · RF-41 a RF-45 | Demo · generar el resumen a partir de lecturas, avisos y dispositivos. Posterior · generar archivos de reporte. | Demo · buscar historial por filtros autorizados. Posterior · descargar exportaciones. | Demo · cambiar filtros y actualizar la vista. | Posterior · retirar archivos de reporte cuando se implemente su almacenamiento. |

### 5.2 Pruebas de operaciones y permisos

1. **Acceso.** Cargar las dos cuentas, comprobar login válido e inválido, consultar la sesión, cerrar sesión y verificar que una solicitud posterior se rechaza. Desactivar una cuenta de prueba y verificar el rechazo con su sesión previa.
2. **Aislamiento.** Intentar consultar una medición ajena desde otra cuenta de astronauta. Comprobar que el admin accede solo a casos derivados de su misión y que el astronauta carece de permiso para cerrarlos como admin.
3. **Captura e historial.** Registrar una lectura manual, enviar dos veces el mismo ID del ESP32, desvincular el dispositivo y comprobar la procedencia histórica y el rechazo de nuevas lecturas de ese dispositivo.
4. **Evaluación y seguimiento.** Verificar la referencia y la evidencia del aviso, añadir una acción, derivar el caso y cerrarlo desde la cuenta autorizada. Comprobar que el historial conserva todas las acciones.
5. **Continuidad.** Guardar ambas clases de lecturas sin Internet en SQLite, reiniciar el servicio, recuperar Internet y sincronizar dos veces. Verificar una copia por ID en PostgreSQL y el estado de confirmación local.

## 6. Reglas y modelo de datos

- **Identidad y procedencia.** El registro manual pertenece al astronauta de la sesión. El servidor asigna las lecturas físicas mediante la vinculación del dispositivo. Cada lectura del ESP32 lleva un identificador único por dispositivo para deduplicar reintentos. Se guardan hora de captura y de recepción en UTC.
- **Calidad y vigencia.** Se validan indicador, unidad, formato y momento de captura. Solo las lecturas válidas y comparables participan en el cálculo. La antigüedad máxima se configura por indicador. El tablero conserva el último dato y visibiliza si está desactualizado.
- **Referencia individual.** Registrar período, número de lecturas y contexto de comparación. Para el pulso se usan lecturas en reposo identificadas como tales. La cantidad mínima, la ventana y la condición de variación sostenida deben definirse para el escenario antes de programar los avisos. Los valores de demo se etiquetan como reglas del prototipo.
- **Avisos y acciones.** Un aviso conserva tipo, evidencia, motivo y versión de la regla. Estados propuestos: abierto, pendiente de revisión y cerrado. El astronauta registra acciones y puede derivar el caso. El admin registra su revisión y cierra el caso derivado.

| Entidad | Datos y relaciones principales |
| --- | --- |
| Usuario y Astronauta | Cuenta, rol y perfil asociado. Permisos limitados al perfil propio o a los casos asignados. |
| Misión y Módulo | Destino, fase, ubicación operativa y período del escenario. |
| Dispositivo | Identificador, credencial, astronauta asignado y última comunicación. |
| Indicador y Medición personal | Tipo, unidad o escala, valor, origen, calidad, hora y contexto de actividad. |
| Perfil de destino y Lectura ambiental | Referencias exteriores con fuente. Telemetría de módulo con variable, valor, unidad, origen y fecha. |
| Referencia individual | Astronauta, indicador, período, contexto y resumen de lecturas comparables. |
| Aviso y Acción de seguimiento | Evidencia, versión de regla y estado. Historial de acciones con autor, fecha y registro de revisión. |

### Contexto del destino y del hábitat

La **gravedad superficial**, la **temperatura exterior** y la **presión exterior** pertenecen al perfil de destino. La temperatura y presión dependen del lugar y momento del escenario. Cada referencia incluye fuente y unidad. La gravedad se usa como contexto de la fase de misión. [Ficha planetaria de NASA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) · [Atmósfera de Marte, NASA](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars/)

Las condiciones del **hábitat, cabina o traje** se registran por módulo y período. La presión de cabina se interpreta junto con la composición del aire. La iluminación interior se muestra junto al sueño para explorar coincidencias temporales. Si se amplía el escenario a radiación, se documentarán por separado la exposición UV y la dosis ionizante medida con dosimetría específica. Los datos del destino y del módulo se muestran como contexto y las reglas fisiológicas de demostración conservan sus parámetros explícitos. [NASA, condiciones ambientales](https://www.nasa.gov/reference/6-0-natural-and-induced-environments-vol-2/) · [NASA, iluminación y ritmo circadiano](https://www.nasa.gov/human-rating-guidance/) · [Agencia Espacial Canadiense, dosimetría](https://www.asc-csa.gc.ca/eng/astronauts/space-medicine/projects-radiation.asp)

## 7. Arquitectura y despliegue

**Decisión aprobada: Next.js para frontend y backend**, con App Router y TypeScript. El equipo local ejecuta Next.js con SQLite. El despliegue de Next.js en Vercel usará PostgreSQL para consolidar las mediciones sincronizadas. La persistencia y la sincronización están pendientes de implementación.

| Capa | Responsabilidad |
| --- | --- |
| Entradas Next.js · `src/app` | Páginas, acciones de formulario y adaptadores HTTP. Mantiene `GET /api/health`. La integración física propone `POST /api/v1/measurements` con credencial del dispositivo. |
| Presentación frontend · `src/frontend/presentation` | Vistas de login, tablero, captura e historial, detalle de aviso y revisión. |
| Aplicación frontend | Coordina filtros, formularios y actualización de datos cuando las vistas incorporen interacción. |
| Aplicación backend · `src/backend/application` | Casos de uso de mediciones, consulta y seguimiento. El formulario, el simulador y el ESP32 reutilizan el registro de mediciones. |
| Dominio backend | Reglas de calidad, comparación y transiciones de avisos. |
| Infraestructura backend | Repositorio SQLite en el equipo local, repositorio PostgreSQL en la nube, autenticación y configuración. |

### Operación local y sincronización

El navegador y el ESP32 se conectan al Next.js del equipo local por la red del hábitat durante la demo. La sesión se valida localmente con las cuentas precargadas. Si se corta Internet, el equipo local sigue disponible. Si el navegador pierde el enlace con ese equipo, debe recuperarlo para iniciar sesión o registrar mediciones.

Guardar cada medición y su entrada pendiente de envío en la misma transacción de SQLite. Usar un ID estable y una restricción de unicidad en PostgreSQL para aceptar reintentos sin duplicar registros. La API de Vercel valida la credencial del equipo local, verifica el alcance autorizado y devuelve una confirmación por registro. Mantener pendiente cada medición hasta recibir su confirmación. Mostrar los rechazos y su motivo para revisión. Incluir un control de reintento manual para la demo.

El MVP sincroniza mediciones nuevas. Los avisos y las acciones se conservan en el entorno donde se generan. La sincronización de cambios en estos registros y la edición desde varios equipos quedan para una fase posterior.

Usar una red local para la prueba con ESP32 y confirmar placa, sensor, receptor y protocolo antes de incorporar el hardware a la demo. La opción propuesta es Wi-Fi con ingesta HTTP y validación de credenciales. En producción, las operaciones remotas usan HTTPS. Proteger cookies, credenciales y datos por rol, y mantener los secretos fuera de Git. La actualización del tablero puede empezar con consultas periódicas. Las reglas de variación se evalúan al aceptar una medición válida. [Next.js, Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

El despliegue inicial de `main` se realizó mediante Vercel CLI. La portada y `/api/health` están implementados y verificados en el despliegue inicial. El vínculo automático GitHub–Vercel sigue pendiente. Para publicar código desde el proyecto ya vinculado localmente, usar `npx vercel deploy --prod` y verificar las rutas del entorno. [README del repositorio](README.md)

## 8. Plan de implementación y verificación

1. **Confirmar parámetros del escenario.** Acordar escala de bienestar, placa y sensor, protocolo y frecuencia de ingesta, vigencia de lecturas, ventana de referencia y regla demostrativa. Validar qué protocolo revisado se puede mostrar, si se incorpora.
2. **Agregar autenticación, persistencia y captura.** Preparar cuentas y misión de demo, aplicar permisos y construir la captura manual y simulada. Verificar que el historial conserva la procedencia.
3. **Completar autoevaluación y respuesta.** Implementar línea base, estado de calidad, explicación del aviso, acciones y revisión. Agregar el contexto de iluminación al historial de sueño.
4. **Integrar y comprobar el ESP32.** Enviar una lectura real, reenviar su identificador para probar deduplicación y cortar la señal para probar vigencia. Mantener el escenario sintético disponible para reproducir el guion.
5. **Implementar sincronización.** Preparar SQLite, la cola persistente y la API en Vercel con PostgreSQL. Verificar reintentos, permisos y deduplicación.
6. **Validar local y producción.** Ejecutar lint, verificación de tipos y build. Verificar la app local con Internet desconectado. Desplegar desde `main` y probar portada, salud, acceso protegido y flujo de demo en Vercel con datos ficticios.

### Guion de aceptación

1. Entrar como astronauta. Registrar sueño manualmente y comprobar una lectura de pulso del ESP32 con su origen visible.
2. Consultar la iluminación del hábitat durante la noche registrada. Cargar una serie sintética con referencia estable y una desviación sostenida.
3. Abrir el aviso, comprobar su explicación, guardar una nota y solicitar revisión. Entrar con el rol admin y cerrar el caso con una observación.
4. Ejecutar casos de lectura inválida, referencia insuficiente y corte de ingesta. Desconectar Internet con la red local activa, volver a iniciar sesión, capturar un dato manual y otro del sensor, y comprobar que ambos siguen en el historial tras reiniciar el servicio.
5. Recuperar Internet y sincronizar. Reenviar el mismo lote y comprobar que PostgreSQL conserva una sola copia por medición. Cortar por separado el enlace con el equipo local y verificar que la captura web se reanuda al recuperarlo.

Los indicadores y escenarios se fundamentan en el [Human Research Roadmap de NASA](https://humanresearchroadmap.nasa.gov/Evidence/) y el [estudio de Inspiration4](https://pmc.ncbi.nlm.nih.gov/articles/PMC11357997/). La entrega debe incluir instrucciones reproducibles, identificación de datos sintéticos y la versión de las reglas de aviso usadas en la demo.
