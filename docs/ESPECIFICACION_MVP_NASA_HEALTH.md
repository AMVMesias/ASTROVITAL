# NASA Health · Especificación del MVP

| Campo | Valor |
| --- | --- |
| Versión | 0.9 |
| Estado | Referencia de implementación para revisión del equipo |
| Fecha | 14 de noviembre de 2026 |
| Trazabilidad | [Requisitos originales v0.2 (RF, RNF y RH)](https://github.com/AMVMesias/NASA_HEALTH/blob/e7d2ac1f25acfee01663027c6c01326d32d101c8/REQUISITOS_NASA_HEALTH.md) |
| Base implementada | Dos aplicaciones Next.js. API local de acceso, usuarios, captura, historial y cola SQLite. Receptor PostgreSQL y módulos de entorno y evaluación pendientes de integración con captura. |
| Producción | [NASA Health en Vercel](https://nasa-health-olive.vercel.app/) · [Estado de la API](https://nasa-health-olive.vercel.app/api/health) |

## 1. Objetivo y definición de éxito

NASA Health es un prototipo web para que un astronauta pueda **recopilar indicadores de salud, evaluar cambios y actuar durante una misión**. El flujo reúne lecturas de sensores, registros manuales y contexto ambiental. Cada aviso explica por qué apareció y permite registrar una acción. [Reto oficial de NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) · [Objetivos ampliados publicados por HackAthlone](https://hackathlone.com/challenges/health-monitoring-software#objectives)

El criterio de éxito de la demo es que la tripulación complete ese flujo desde el inicio de sesión hasta el seguimiento y cierre del aviso. La orientación es demostrativa e incluye verificar el dato, repetir una medición, anotar contexto y registrar la resolución. Si el equipo dispone de un protocolo revisado para el escenario, el aviso puede abrirlo como material de consulta. La validación clínica, el diagnóstico, el tratamiento automatizado y el uso operativo en vuelo quedan fuera del MVP.

## 2. Modelo de negocio y operación

| Elemento | Definición |
| --- | --- |
| Usuario principal | Astronauta que registra indicadores, evalúa su evolución, atiende avisos y registra su seguimiento o cierre. |
| Usuario secundario | Admin que crea, consulta, actualiza e inhabilita cuentas desde la web y asigna roles (`astronauta` o `admin`), sin acceso a mediciones personales ni avisos de salud. |
| Organización usuaria | Equipo de misión o simulación que prepara el escenario base (misión, módulo, destino, vinculación inicial de dispositivos y protocolos disponibles) y aprovisiona la cuenta inicial de admin. |
| Propuesta de valor | Consultar en un solo lugar qué cambió, en qué contexto ocurrió y qué hizo la tripulación. |
| Operación | Cuenta inicial de admin, misión, módulo y dispositivos precargados. El admin gestiona cuentas e inhabilitación desde el panel web; cada astronauta accede únicamente a sus propios registros y avisos. |
| Éxito del prototipo | Completar el guion de aceptación con un usuario que pueda explicar el aviso, registrar el seguimiento y localizar la evidencia. |

El MVP valida la utilidad del flujo para la tripulación. La comercialización, los precios y la contratación quedan para una etapa posterior.

## 3. Alcance

| Capacidad | Entrega del MVP |
| --- | --- |
| Acceso | Inicio y cierre de sesión, cuenta inicial de admin precargada, creación e inhabilitación de cuentas desde la web (`astronauta` y `admin`), protección de páginas y operaciones de servidor. Primer acceso obligatorio con cambio de contraseña inicial y tres preguntas de seguridad; recuperación mediante una de ellas, elegida al azar, con máximo tres intentos. Estos dos últimos flujos están pendientes de integración real. |
| Escenario | Una misión y un módulo precargados. El selector pendiente de integración ofrecerá cuatro escenarios de referencia del catálogo local. |
| Captura personal | Horas de sueño y bienestar por formulario, y frecuencia cardíaca en reposo por ESP32. El simulador usa el mismo flujo de registro y facilita una demo reproducible mientras se verifica el hardware. |
| Tablero | Último valor, unidad, antigüedad, origen, calidad, referencia personal e historial por indicador y período. |
| Contexto ambiental | Ficha de destino y telemetría de iluminación simulada del módulo junto al historial de sueño. El modelo admite temperatura y presión de cabina, oxígeno, CO₂ y humedad. |
| Avisos | Avisos de calidad y de variación demostrativa, con explicación, orientación operativa, acción registrada y cierre por el propio astronauta. |
| Continuidad | Next.js con SQLite en el equipo local para operar sin Internet. Next.js en Vercel con PostgreSQL consolida las mediciones al recuperar conexión. La instalación como PWA y el almacenamiento en IndexedDB quedan fuera del MVP. |

Las vistas del MVP cubren portada (`/`) y páginas informativas, acceso (`/login`), tablero con captura e historial (`/dashboard`), detalle/cierre de aviso y gestión de usuarios para el rol `admin` (`/usuarios` y `/usuarios/nuevo`); las rutas `/reportes` y `/configuracion` del panel quedan como marcadores reservados. El registro público, las exportaciones, la gestión de múltiples misiones, la sincronización con Tierra y la gamificación quedan para fases posteriores.

## 4. Actores y casos de uso

| ID | Caso y actor | Flujo principal | Alternativa o resultado |
| --- | --- | --- | --- |
| CU-01 | Iniciar y cerrar sesión · astronauta y admin | La persona entra con una cuenta habilitada. Si tiene pendiente el primer acceso, completa CU-11; en accesos posteriores entra a la vista de su rol. Puede cerrar la sesión. | Con credenciales incorrectas o cuenta inhabilitada se muestra un error. Sin sesión o permiso se deniega el acceso. |
| CU-02 | Recibir medición · ESP32 | El ESP32 notifica el pulso por Bluetooth Low Energy al portátil. El puente presenta la credencial del dispositivo a la API local. El servidor valida la lectura, identifica al astronauta asignado y la guarda. | Si se reenvía la misma lectura, se guarda una sola vez. Los datos inválidos quedan fuera del cálculo de tendencias. |
| CU-03 | Registrar dato manual · astronauta | Selecciona el indicador, registra valor y momento, y añade contexto si corresponde. | El error de validación explica qué campo corregir. El registro aceptado aparece en el historial con origen manual. |
| CU-04 | Evaluar un cambio · astronauta | Consulta la tendencia frente a su referencia individual y revisa el origen, calidad y antigüedad del dato. | Si faltan lecturas comparables, se muestra «Datos insuficientes». Si la última lectura quedó desactualizada, se indica su antigüedad. |
| CU-05 | Consultar el entorno · astronauta | Revisa el destino, la fase y el módulo. En el historial de sueño, consulta la iluminación del módulo durante el período seleccionado. | Si falta telemetría, se muestra la ausencia de datos. Las coincidencias en el tiempo se presentan como contexto. |
| CU-06 | Atender y cerrar aviso · astronauta | Abre el aviso, lee el motivo, registra una repetición o una observación y actualiza su estado (`en seguimiento` o `cerrado`). | Cada acción queda asociada al aviso con autor, fecha y cambio de estado. El cierre conserva toda la evidencia previa. |
| CU-07 | Administrar usuarios · admin | Desde `/usuarios` y `/usuarios/nuevo`, crea cuentas (`astronauta` o `admin`) con su perfil básico, consulta el listado y cambia su rol o estado (habilitar/inhabilitar). | Al inhabilitar una cuenta se invalidan sus sesiones activas conservando historial y autoría. El admin no accede a mediciones personales ni avisos de salud. |
| CU-08 | Ejecutar escenario · equipo de demo | Carga una serie sintética reproducible para demostrar variación, falta de datos y el seguimiento. | Los registros se identifican como simulados en el tablero y el historial. |
| CU-09 | Operar sin Internet · astronauta y ESP32 | Con la red local activa, el astronauta inicia sesión, registra datos y consulta el historial. El puente sigue entregando a Next.js local las lecturas que recibe del ESP32 por BLE. | SQLite conserva las lecturas tras reiniciar el servicio. Si se pierde acceso al equipo local, la captura web se reanuda al recuperar ese enlace. |
| CU-10 | Sincronizar mediciones · equipo local | Al recuperar Internet, Next.js local envía los registros pendientes a la API en Vercel y recibe una confirmación por registro. | Los errores transitorios permiten reenviar los mismos IDs. Los rechazos se muestran con su motivo. |
| CU-11 | Completar primer acceso · astronauta y admin | Tras validar las credenciales iniciales entregadas por el admin, define una contraseña nueva y elige tres preguntas distintas, con una respuesta por pregunta. | El servidor habilita el panel solo después de guardar toda la configuración. Si abandona o falla el guardado, el primer acceso sigue pendiente. No existe registro público. |
| CU-12 | Recuperar contraseña · astronauta y admin | En `/login`, pulsa «Recuperar contraseña», indica su usuario y responde una sola de sus tres preguntas guardadas, elegida aleatoriamente por el servidor. Si la respuesta es correcta, define y confirma una contraseña nueva. | Cada fallo consume un intento. Al tercer fallo se bloquea la recuperación y se indica contactar al administrador. Volver atrás, recargar o pedir otro desafío no reinicia el contador. |

## 5. Requisitos trazables y criterios de aceptación

Los IDs de esta tabla organizan la implementación del MVP. La última columna remite a los requisitos originales que desarrolla cada fila.

| ID | Requisito del MVP | Evidencia de aceptación | Referencia v0.2 |
| --- | --- | --- | --- |
| MVP-01 | Autenticación, administración básica de cuentas y autorización por rol. | Inicio y cierre exitosos; el admin crea e inhabilita cuentas desde la web y una cuenta inhabilitada o sin permiso queda bloqueada en páginas y operaciones protegidas. | RF-01 a RF-07, RNF-01 a RNF-04 |
| MVP-02 | Identificar astronauta, misión, fase y módulo en el tablero. | La cuenta de astronauta muestra su perfil y el contexto precargado de la misión y módulo asignados. | RF-08 a RF-13 |
| MVP-03 | Capturar lecturas manuales, simuladas y de dispositivo con procedencia explícita. | El historial conserva unidad, origen, autor o dispositivo, fecha de captura y estado de calidad. | RF-14 a RF-25, RF-26 a RF-30, RF-37 a RF-40, RNF-05, RNF-06, RNF-14, RH-01 a RH-08 |
| MVP-04 | Comparar lecturas válidas con una referencia personal y mostrar historial. | El tablero explica el período de referencia y el cambio. Una serie insuficiente produce el estado correspondiente. | RF-20 a RF-30, RF-41, RF-42 |
| MVP-05 | Mostrar contexto ambiental por ubicación y tiempo. | Una noche de sueño se puede consultar junto a la iluminación de su módulo, con fuente y hora visibles. | Extiende RF-23 a RF-25 y el modelo de datos v0.2 |
| MVP-06 | Distinguir aviso de calidad de aviso por variación. | Una lectura inválida o ausente y una variación sostenida producen indicadores de estado distintos. El aviso muestra su motivo. | RF-19, RF-31 a RF-36, RF-42, RF-43, RNF-07, RNF-08, RNF-15 |
| MVP-07 | Registrar acciones y cerrar avisos con trazabilidad. | El astronauta registra una acción (repetición u observación) y cierra o deja en seguimiento su propio aviso conservando el historial. | Extiende RF-33 a RF-36 |
| MVP-08 | Operar en la red local con Next.js y SQLite. | Con Internet desconectado funcionan login, gestión local de usuarios habilitados, formulario, historial e ingesta del ESP32. Reiniciar el servicio conserva los registros. Al cortar el sensor se conserva la última lectura y se indica su antigüedad. | RNF-07 a RNF-13, RH-07, RH-08 |
| MVP-09 | Sincronizar mediciones nuevas con PostgreSQL. | Al restablecer Internet, enviar los pendientes y repetir el mismo lote. Confirmar una sola copia por ID en la nube y el estado sincronizado en el equipo local. | Extiende RF-26 a RF-30 y RNF-05 a RNF-08 |
| MVP-10 | Exigir configuración del primer acceso para cuentas creadas por el administrador. | Una cuenta nueva no puede abrir el panel ni ejecutar sus operaciones protegidas hasta completar el cambio de contraseña y las tres preguntas. Tras guardar y volver a entrar, se omite este paso. | Nuevo · CU-11; amplía RF-01, RF-02, RF-04, RF-06 |
| MVP-11 | Cambiar la contraseña inicial y confirmar la nueva. | Rechazar una contraseña igual a la inicial, fuera de la política de 12–128 caracteres o con confirmación diferente. Un fallo de validación no habilita el panel. | Nuevo · CU-11; amplía RNF-02, RNF-05 |
| MVP-12 | Configurar tres preguntas distintas del catálogo con una respuesta no vacía por pregunta. | Mostrar tres desplegables y tres campos de respuesta. Rechazar duplicados, IDs fuera del catálogo o respuestas vacías también en el servidor. Guardar la configuración completa, nunca parcialmente. | Nuevo · CU-11; amplía RNF-02, RNF-04, RNF-05 |
| MVP-13 | Recuperar el acceso con una sola pregunta aleatoria y máximo tres intentos. | El servidor selecciona una de las tres preguntas configuradas y la mantiene durante el desafío. Una respuesta correcta permite continuar; tres incorrectas bloquean la recuperación de esa cuenta. El bloqueo persiste al recargar y al crear otro desafío. | Nuevo · CU-12; amplía RF-02, RNF-03, RNF-04 |
| MVP-14 | Autorizar y persistir de forma segura el restablecimiento de contraseña. | Impedir el cambio sin respuesta validada en el servidor. La autorización temporal es de un solo uso y tiene caducidad. El cambio invalida sesiones y desafíos previos; el siguiente login acepta la nueva contraseña y rechaza la anterior. | Nuevo · CU-12; amplía RNF-02 a RNF-05 |

Los requisitos MVP-10 a MVP-14 incorporan las decisiones posteriores sobre primer acceso y recuperación. No estaban explícitos en los requisitos históricos v0.2. Su detalle y estado real se mantienen en [Primer acceso y recuperación](PRIMER_ACCESO_Y_RECUPERACION.md).

### 5.1 Operaciones CRUD y permisos

**Demo** se implementa en el flujo del MVP. **Preparación** se resuelve con datos iniciales o configuración base del entorno (misión, módulo, destino, catálogo, dispositivos ESP32 y cuenta semilla de admin). **Posterior** queda en el backlog. En esta matriz, retirar puede significar inhabilitar, desvincular, archivar o revocar, según el recurso. Los únicos roles de la aplicación son `astronauta` y `admin`, con separación limpia de responsabilidades: el **admin** gestiona usuarios y perfiles básicos en la web (`/usuarios` y `/usuarios/nuevo`) sin acceso a mediciones personales ni avisos de salud; cada **astronauta** accede exclusivamente a sus propios registros y avisos.

| Recurso y trazabilidad | Crear | Consultar | Actualizar | Retirar |
| --- | --- | --- | --- | --- |
| Cuentas y roles · RF-06, RF-07 | Preparación · cuenta inicial de admin (y opcional de demo). Demo · el admin crea cuentas con credenciales hasheadas y rol (`astronauta` o `admin`) en `/usuarios/nuevo`. | Demo · cada usuario consulta su identidad y rol propios; el admin lista cuentas y su estado en `/usuarios`. | Demo · el admin cambia rol, habilitación o credencial; los cambios de rol o credencial exigen sesión nueva. | Demo · el admin inhabilita una cuenta e invalida sus sesiones activas, conservando autoría e historial. |
| Sesiones · CU-01, RF-01 a RF-05 | Demo · autenticar credenciales de cuenta habilitada y abrir sesión local. | Demo · comprobar vigencia, cuenta habilitada y permisos en el servidor. | Demo · aplicar caducidad de sesión. Los cambios de credenciales, rol o inhabilitación invalidan la sesión previa. | Demo · cerrar sesión e invalidarla. |
| Perfiles · RF-08 a RF-10, RF-13 | Demo · el admin crea el perfil básico del astronauta al dar de alta su cuenta y lo asocia al escenario precargado. | Demo · el astronauta ve su perfil; el admin consulta perfiles básicos en `/usuarios` (sin datos de salud). | Demo · el admin corrige datos básicos del perfil. | Posterior · archivar perfil conservando mediciones y acciones (en Demo se inhabilita la cuenta asociada). |
| Misiones, módulos, destino y asignaciones · RF-11, RF-12, MVP-02, MVP-05 | Preparación · cargar misión, fase, módulo, destino y asignación base. | Demo · consultar el contexto autorizado y la ficha del destino. | Preparación · configurar la misión de demo. Posterior · administrar fases y múltiples misiones desde la web. | Posterior · cerrar o archivar y conservar el contexto histórico. |
| Dispositivos, sensores y vínculos · RF-14 a RF-19, RF-43 | Preparación · registrar ESP32, sensor y vínculo con el astronauta en configuración inicial. | Demo · el astronauta consulta origen, estado y última comunicación de su dispositivo asociado. | Preparación · reasignar o rotar la credencial. Demo · actualizar la última comunicación al recibir una lectura aceptada. Posterior · gestión en `/configuracion`. | Preparación · desvincular o revocar el dispositivo y conservar la procedencia histórica. |
| Catálogo de indicadores y reglas · RF-20 a RF-25, RF-31 a RF-36 | Preparación · cargar indicadores, unidades, escalas y reglas versionadas. | Demo · mostrar los disponibles y explicar la regla de cada aviso. | Preparación · publicar una versión nueva conservando la aplicada a avisos anteriores. | Posterior · desactivar para nuevas mediciones preservando el historial. |
| Mediciones personales · CU-02 a CU-04, RF-15, RF-20 a RF-30 | Demo · el astronauta registra manualmente. El ESP32 y el simulador envían lecturas con su procedencia. | Demo · el astronauta consulta último valor e historial propio filtrado por indicador y período (sin acceso para admin ni terceros). | Demo · el sistema actualiza vigencia y sincronización. Posterior · correcciones trazables de valores. Una repetición crea otra lectura. | Posterior · aplicar política de retención. |
| Lecturas ambientales · CU-05, MVP-05 | Demo · cargar iluminación simulada por módulo y hora. | Demo · el astronauta consulta ambiente y sueño en el mismo período. | Preparación · ajustar la configuración del escenario. La siguiente observación se guarda como lectura nueva. | Posterior · aplicar retención manteniendo la trazabilidad del escenario. |
| Referencia individual · CU-04, MVP-04 | Demo · calcular referencia con lecturas válidas y comparables. | Demo · el astronauta consulta su valor, período, cantidad de muestras y contexto. | Demo · recalcular según la regla configurada y conservar la evidencia usada en cada aviso. | Posterior · gestionar referencias históricas. |
| Avisos · CU-06, RF-31 a RF-36 | Demo · el sistema genera un aviso por calidad o por variación para el astronauta. | Demo · cada astronauta lista únicamente sus avisos propios (sin acceso para admin). | Demo · el astronauta registra seguimiento y cambia su estado (`abierto`, `en seguimiento`, `cerrado`). | Posterior · archivar según la política de retención. |
| Acciones de seguimiento · CU-06 | Demo · el astronauta registra repetición, nota o cierre con autor y fecha. | Demo · el astronauta consulta las acciones desde su aviso. | Demo · el astronauta anexa una acción nueva para ampliar o cerrar una observación. | Posterior · aplicar retención de auditoría. |
| Escenarios de simulación · CU-08, RF-37 a RF-40 | Preparación · definir series sintéticas. Demo · ejecutar un escenario y generar lecturas etiquetadas. | Demo · identificar escenario y origen simulado en el historial. | Preparación · versionar escenarios. | Preparación · reiniciar el entorno de demo con datos ficticios. |
| Cola de sincronización · CU-10, MVP-09 | Demo · generar un pendiente por medición local en la misma transacción. | Demo · consultar pendientes, confirmaciones y rechazos. | Demo · enviar, reintentar con el mismo ID y registrar la confirmación de PostgreSQL. | Posterior · depurar registros confirmados según retención. |
| Tablero, reportes y exportación · RF-41 a RF-45 | Demo · generar el resumen del astronauta a partir de lecturas, avisos y dispositivos. Posterior · generar archivos de reporte. | Demo · buscar historial propio por filtros autorizados. Posterior · descargar exportaciones en `/reportes`. | Demo · cambiar filtros y actualizar la vista. | Posterior · retirar archivos de reporte cuando se implemente su almacenamiento. |

### 5.2 Pruebas de operaciones y permisos

1. **Acceso e inhabilitación.** Entrar con el admin inicial, crear una cuenta de astronauta en `/usuarios/nuevo`, comprobar login válido e inválido, consultar la sesión, cerrar sesión y verificar que una solicitud posterior se rechaza. Inhabilitar la cuenta desde `/usuarios` y verificar el rechazo inmediato tanto en su sesión previa como en un nuevo intento de acceso.
2. **Aislamiento entre roles.** Intentar consultar una medición o aviso ajeno desde otra cuenta de astronauta y verificar el rechazo. Comprobar que un astronauta carece de permiso para `/usuarios`, `/usuarios/nuevo` y sus operaciones, y que el admin tampoco puede consultar ni modificar mediciones personales o avisos de salud.
3. **Captura e historial.** Registrar una lectura manual como astronauta, enviar dos veces el mismo ID del ESP32, desvincular el dispositivo en configuración inicial y comprobar la procedencia histórica y el rechazo de nuevas lecturas de ese dispositivo.
4. **Evaluación y cierre.** Verificar la referencia y la evidencia del aviso como astronauta, añadir una acción, pasar el aviso a seguimiento y cerrarlo con la misma cuenta autorizada. Comprobar que el historial conserva todas las acciones.
5. **Continuidad.** Guardar ambas clases de lecturas sin Internet en SQLite, reiniciar el servicio, recuperar Internet y sincronizar dos veces. Verificar una copia por ID en PostgreSQL y el estado de confirmación local.

### 5.3 Aceptación del primer acceso y la recuperación

1. Crear una cuenta desde el admin. Comprobar que solo permite completar el primer acceso, incluso al intentar acceder directamente al panel o a sus APIs.
2. Probar contraseña inicial repetida, confirmación distinta, preguntas duplicadas, pregunta inexistente y respuestas en blanco. Ningún caso habilita la cuenta para el panel.
3. Guardar una contraseña nueva y las tres respuestas válidas. Reiniciar el servicio y verificar que la configuración persiste y que el siguiente login no repite el primer acceso.
4. Recuperar con una de las tres preguntas seleccionada por el servidor. Verificar que nunca se envían las respuestas guardadas al navegador y que la pregunta permanece fija durante el desafío.
5. Fallar dos veces, volver atrás y recargar. Debe quedar un solo intento. Fallar la tercera vez y solicitar un desafío nuevo: la recuperación sigue bloqueada y muestra la indicación de contactar al admin.
6. En otra cuenta de prueba, responder correctamente y restablecer la contraseña. Rechazar autorización ausente, caducada o reutilizada; verificar revocación de sesiones y credenciales anteriores.
7. Comprobar la transición de la tarjeta, navegación por teclado, movimiento reducido y visualización en PC y móvil. El flujo local debe funcionar sin Internet mientras exista conexión con el servidor local.

## 6. Reglas y modelo de datos

- **Identidad y procedencia.** El registro manual pertenece al astronauta de la sesión. El servidor asigna las lecturas físicas mediante la vinculación del dispositivo. Cada lectura del ESP32 lleva un identificador único por dispositivo para deduplicar reintentos. Se guardan hora de captura y de recepción en UTC.
- **Calidad y vigencia.** Se validan indicador, unidad, formato y momento de captura. Solo las lecturas válidas y comparables participan en el cálculo. La antigüedad máxima se configura por indicador. El tablero conserva el último dato y visibiliza si está desactualizado.
- **Referencia individual.** Registrar período, número de lecturas y contexto de comparación. Para el pulso se usan lecturas en reposo identificadas como tales. La cantidad mínima, la ventana y la condición de variación sostenida deben definirse para el escenario antes de programar los avisos. Los valores de demo se etiquetan como reglas del prototipo.
- **Avisos y acciones.** Un aviso conserva tipo, evidencia, motivo y versión de la regla. Estados propuestos: `abierto`, `en seguimiento` y `cerrado`. El astronauta registra acciones de verificación o contexto y cierra el aviso cuando queda atendido.

| Entidad | Datos y relaciones principales |
| --- | --- |
| Usuario y Astronauta | Cuenta, estado de primer acceso pendiente o completado, rol (`astronauta` o `admin`), estado (habilitada o inhabilitada) y perfil asociado cuando es astronauta. El admin gestiona cuentas sin acceder a datos de salud; el astronauta accede solo a su perfil, mediciones y avisos. |
| Misión y Módulo | Destino, fase, ubicación operativa y período del escenario. |
| Configuración de recuperación | Tres IDs de pregunta por cuenta y sus hashes de respuesta con sal. Desafío con pregunta seleccionada, contador persistente de fallos y bloqueo; autorización temporal de restablecimiento con caducidad y consumo. Pendiente de implementar. |
| Dispositivo | Identificador, credencial, astronauta asignado y última comunicación. |
| Indicador y Medición personal | Tipo, unidad o escala, valor, origen, calidad, hora y contexto de actividad. |
| Perfil de destino y Lectura ambiental | Referencias exteriores con fuente. Telemetría de módulo con variable, valor, unidad, origen y fecha. |
| Referencia individual | Astronauta, indicador, período, contexto y resumen de lecturas comparables. |
| Aviso y Acción de seguimiento | Evidencia, versión de regla y estado. Historial de acciones con autor, fecha y registro de cierre. |

### Contexto del destino y del hábitat

La **gravedad superficial**, la **temperatura exterior** y la **presión exterior** pertenecen al perfil de destino. La temperatura y presión dependen del lugar y momento del escenario. Cada referencia incluye fuente y unidad. La gravedad se usa como contexto de la fase de misión. [Ficha planetaria de NASA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) · [Atmósfera de Marte, NASA](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars/)

Las condiciones del **hábitat, cabina o traje** se registran por módulo y período. La presión de cabina se interpreta junto con la composición del aire. La iluminación interior se muestra junto al sueño para explorar coincidencias temporales. Si se amplía el escenario a radiación, se documentarán por separado la exposición UV y la dosis ionizante medida con dosimetría específica. Los datos del destino y del módulo se muestran como contexto y las reglas fisiológicas de demostración conservan sus parámetros explícitos. [NASA, condiciones ambientales](https://www.nasa.gov/reference/6-0-natural-and-induced-environments-vol-2/) · [NASA, iluminación y ritmo circadiano](https://www.nasa.gov/human-rating-guidance/) · [Agencia Espacial Canadiense, dosimetría](https://www.asc-csa.gc.ca/eng/astronauts/space-medicine/projects-radiation.asp)

## 7. Arquitectura y despliegue

**Decisión aprobada: Next.js para frontend y backend**, con App Router y TypeScript. El equipo local ejecuta Next.js con SQLite. El despliegue de Next.js en Vercel usará PostgreSQL para consolidar las mediciones sincronizadas. SQLite, la cola y el receptor PostgreSQL están implementados. La instancia en la nube y la prueba integral siguen pendientes.

| Capa | Responsabilidad |
| --- | --- |
| Entradas Next.js · `src/frontend/src/app` y `src/backend/src/app` | Páginas públicas (`/`, `/acerca`, `/recursos`, `/legal`), acceso (`/login`), rutas de `(panel)` (`/dashboard`, `/usuarios`, `/usuarios/nuevo`, más rutas reservadas `/reportes` y `/configuracion`) y adaptadores HTTP (`GET /api/health` y `POST /api/v1/measurements`). |
| Presentación y módulos frontend · `src/frontend` | `presentation/` (portada), `components/` (layout y UI), `features/` (`auth`, `usuarios`, `dashboard`, `reportes`) y `lib/api.ts` para login, tablero, captura e historial, avisos y administración de usuarios. |
| Aplicación frontend | Coordina filtros, formularios y actualización de datos cuando las vistas incorporen interacción. |
| Aplicación backend · `src/backend/src/backend/application` | Casos de uso de mediciones, consulta y seguimiento. El formulario, el simulador y el ESP32 reutilizan el registro de mediciones. |
| Dominio backend | Reglas de calidad, comparación y transiciones de avisos. |
| Infraestructura backend | Repositorio SQLite en el equipo local, repositorio PostgreSQL en la nube, autenticación y configuración. |

### Operación local y sincronización

El navegador accede a Next.js en la red local. Para la demo se propone que el ESP32 envíe pulso por BLE a un puente en el portátil, que entrega las lecturas a la API local. La sesión se valida localmente con las cuentas precargadas. Si se corta Internet, el equipo local sigue disponible. Si el navegador pierde el enlace con ese equipo, debe recuperarlo para iniciar sesión o registrar mediciones.

Guardar cada medición y su entrada pendiente de envío en la misma transacción de SQLite. Usar un ID estable y una restricción de unicidad en PostgreSQL para aceptar reintentos sin duplicar registros. La API de Vercel valida la credencial del equipo local, verifica el alcance autorizado y devuelve una confirmación por registro. Mantener pendiente cada medición hasta recibir su confirmación. Mostrar los rechazos y su motivo para revisión. Incluir un control de reintento manual para la demo.

El MVP sincroniza mediciones nuevas. Los avisos y las acciones se conservan en el entorno donde se generan. La sincronización de cambios en estos registros y la edición desde varios equipos quedan para una fase posterior.

Usar una red local para la prueba con ESP32 y confirmar placa, sensor, receptor y protocolo antes de incorporar el hardware a la demo. La integración propuesta utiliza Bluetooth Low Energy entre la placa y el portátil, y HTTP entre el puente y la API local. Firmware implementa la emisión BLE. La Persona 1 integra el puente y la Persona 2 conecta contexto histórico, vigencia y evaluación. El contrato GATT y la prueba física están pendientes. [Plan de integración](PLAN_BACKEND_MVP.md) En producción, las operaciones remotas usan HTTPS. Proteger cookies, credenciales y datos por rol, y mantener los secretos fuera de Git. La actualización del tablero puede empezar con consultas periódicas. Las reglas de variación se evalúan al aceptar una medición válida. [Next.js, Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

El despliegue inicial de `main` se realizó mediante Vercel CLI. La portada y `/api/health` están implementados y verificados en el despliegue inicial. El vínculo automático GitHub–Vercel sigue pendiente. Para publicar código desde el proyecto ya vinculado localmente, usar `npx vercel deploy --prod` y verificar las rutas del entorno. [README del repositorio](../README.md)

## 8. Verificación

El orden de trabajo, los responsables y las pruebas técnicas están en el [plan de integración](PLAN_BACKEND_MVP.md).

### Guion de aceptación

1. Entrar como admin inicial en `/login`, completar el primer acceso si está pendiente y luego ir a `/usuarios/nuevo`, crear una cuenta de astronauta y verificar su asignación a la misión y módulo precargados.
2. Entrar como astronauta y completar el primer acceso (contraseña nueva y tres preguntas distintas). Verificar por separado la recuperación y el bloqueo de tres intentos según la sección 5.3. Registrar sueño manualmente y comprobar una lectura de pulso del ESP32 con su origen visible.
3. Consultar la iluminación del hábitat durante la noche registrada. Cargar una serie sintética con referencia estable y una desviación sostenida.
4. Abrir el aviso, comprobar su explicación, guardar una nota de seguimiento y cerrarlo desde la cuenta del astronauta.
5. Ejecutar casos de lectura inválida, referencia insuficiente y corte de ingesta. Volver a entrar como admin, inhabilitar una cuenta de prueba en `/usuarios` y comprobar que su sesión previa y nuevo acceso quedan bloqueados. Desconectar Internet con la red local activa, iniciar sesión con una cuenta habilitada, capturar un dato manual y otro del sensor, y comprobar que ambos siguen en el historial tras reiniciar el servicio.
6. Recuperar Internet y sincronizar. Reenviar el mismo lote y comprobar que PostgreSQL conserva una sola copia por medición. Cortar por separado el enlace con el equipo local y verificar que la captura web se reanuda al recuperarlo.

Los indicadores y escenarios se fundamentan en el [Human Research Roadmap de NASA](https://humanresearchroadmap.nasa.gov/Evidence/) y el [estudio de Inspiration4](https://pmc.ncbi.nlm.nih.gov/articles/PMC11357997/). La entrega debe incluir instrucciones reproducibles, identificación de datos sintéticos y la versión de las reglas de aviso usadas en la demo.
