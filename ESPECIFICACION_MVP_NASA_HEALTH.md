# NASA Health · Especificación del MVP

| Campo | Valor |
| --- | --- |
| Versión | 0.3 |
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
| Usuario secundario | Responsable de salud de la tripulación que revisa los casos derivados y registra su resolución. |
| Organización usuaria | Operador de misión o equipo de simulación que prepara el escenario, asigna dispositivos y define qué protocolos están disponibles. |
| Propuesta de valor | Consultar en un solo lugar qué cambió, en qué contexto ocurrió y qué hizo la tripulación. |
| Operación | Cuentas, misión y módulo precargados. Cada astronauta accede a sus registros. El responsable accede a los casos derivados de la misión asignada. |
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
| Continuidad | Despliegue en Vercel para acceso web y ejecución local con base de datos y autenticación local para la demo sin Internet. |

Las vistas iniciales son inicio de sesión, tablero con captura e historial, detalle de aviso y una lista sencilla de casos derivados para la segunda cuenta. La administración avanzada, el registro público, las exportaciones, la gestión de múltiples misiones, la sincronización con Tierra y la gamificación quedan para fases posteriores.

## 4. Actores y casos de uso

| ID | Caso y actor | Flujo principal | Alternativa o resultado |
| --- | --- | --- | --- |
| CU-01 | Iniciar y cerrar sesión · astronauta y responsable de salud | La persona entra con una cuenta precargada y accede a la vista de su rol. Puede cerrar la sesión. | Con credenciales incorrectas se muestra un error. Sin sesión o permiso se deniega el acceso. |
| CU-02 | Recibir medición · ESP32 | El dispositivo se autentica y envía una lectura. El servidor valida los datos, identifica al astronauta asignado y guarda la lectura. | Si se reenvía la misma lectura, se guarda una sola vez. Los datos inválidos quedan fuera del cálculo de tendencias. |
| CU-03 | Registrar dato manual · astronauta | Selecciona el indicador, registra valor y momento, y añade contexto si corresponde. | El error de validación explica qué campo corregir. El registro aceptado aparece en el historial con origen manual. |
| CU-04 | Evaluar un cambio · astronauta | Consulta la tendencia frente a su referencia individual y revisa el origen, calidad y antigüedad del dato. | Si faltan lecturas comparables, se muestra «Datos insuficientes». Si la última lectura quedó desactualizada, se indica su antigüedad. |
| CU-05 | Consultar el entorno · astronauta | Revisa el destino, la fase y el módulo. En el historial de sueño, consulta la iluminación del módulo durante el período seleccionado. | Si falta telemetría, se muestra la ausencia de datos. Las coincidencias en el tiempo se presentan como contexto. |
| CU-06 | Atender aviso · astronauta | Abre el aviso, lee el motivo y registra una repetición, una observación o la solicitud de revisión. | La acción queda asociada al aviso con autor y fecha. Si solicita revisión, el caso aparece en la lista del responsable. |
| CU-07 | Revisar caso · responsable de salud | Consulta la evidencia y las acciones previas, registra su evaluación y cierra el caso. | Se conserva el historial de acciones. |
| CU-08 | Ejecutar escenario · equipo de demo | Carga una serie sintética reproducible para demostrar variación, falta de datos y el seguimiento. | Los registros se identifican como simulados en el tablero y el historial. |

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
| MVP-07 | Registrar acciones y resolver casos derivados. | La cuenta del astronauta solicita revisión y la del responsable registra una acción y cierra el caso. | Extiende RF-33 a RF-36 |
| MVP-08 | Operar en el portátil de demo y documentar el arranque. | Con Internet desconectado funcionan el login, el formulario y el historial. Al cortar el sensor se conserva la lectura anterior con antigüedad visible. | RNF-07 a RNF-13, RH-07, RH-08 |

## 6. Reglas y modelo de datos

- **Identidad y procedencia.** El registro manual pertenece al astronauta de la sesión. El servidor asigna las lecturas físicas mediante la vinculación del dispositivo. Cada lectura del ESP32 lleva un identificador único por dispositivo para deduplicar reintentos. Se guardan hora de captura y de recepción en UTC.
- **Calidad y vigencia.** Se validan indicador, unidad, formato y momento de captura. Solo las lecturas válidas y comparables participan en el cálculo. La antigüedad máxima se configura por indicador. El tablero conserva el último dato y visibiliza si está desactualizado.
- **Referencia individual.** Registrar período, número de lecturas y contexto de comparación. Para el pulso se usan lecturas en reposo identificadas como tales. La cantidad mínima, la ventana y la condición de variación sostenida deben definirse para el escenario antes de programar los avisos. Los valores de demo se etiquetan como reglas del prototipo.
- **Avisos y acciones.** Un aviso conserva tipo, evidencia, motivo y versión de la regla. Estados propuestos: abierto, pendiente de revisión y cerrado. El astronauta registra acciones y puede derivar el caso. El responsable registra su revisión y cierra el caso derivado.

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

**Decisión aprobada: Next.js para frontend y backend**, con App Router y TypeScript. PostgreSQL es la opción propuesta para persistencia. La base local se utiliza para verificar el flujo sin Internet. El entorno Vercel necesitará una instancia accesible desde el despliegue cuando se incorpore persistencia.

| Capa | Responsabilidad |
| --- | --- |
| Entradas Next.js · `src/app` | Páginas, acciones de formulario y adaptadores HTTP. Mantiene `GET /api/health`. La integración física propone `POST /api/v1/measurements` con credencial del dispositivo. |
| Presentación frontend · `src/frontend/presentation` | Vistas de login, tablero, captura e historial, detalle de aviso y revisión. |
| Aplicación frontend | Coordina filtros, formularios y actualización de datos cuando las vistas incorporen interacción. |
| Aplicación backend · `src/backend/application` | Casos de uso de mediciones, consulta y seguimiento. El formulario, el simulador y el ESP32 reutilizan el registro de mediciones. |
| Dominio backend | Reglas de calidad, comparación y transiciones de avisos. |
| Infraestructura backend | Repositorios PostgreSQL, autenticación y acceso a configuración. |

Usar una red local para la prueba con ESP32 y confirmar placa, sensor, receptor y protocolo antes de incorporar el hardware a la demo. La opción propuesta es Wi-Fi con ingesta HTTP y validación de credenciales. En producción, las operaciones remotas usan HTTPS. Proteger cookies, credenciales y datos por rol, y mantener los secretos fuera de Git. La actualización del tablero puede empezar con consultas periódicas. Las reglas de variación se evalúan al aceptar una medición válida. [Next.js, Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

El despliegue inicial de `main` se realizó mediante Vercel CLI. La portada y `/api/health` están implementados y verificados en el despliegue inicial. El vínculo automático GitHub–Vercel sigue pendiente. Para publicar código desde el proyecto ya vinculado localmente, usar `npx vercel deploy --prod` y verificar las rutas del entorno. [README del repositorio](README.md)

## 8. Plan de implementación y verificación

1. **Confirmar parámetros del escenario.** Acordar escala de bienestar, placa y sensor, protocolo y frecuencia de ingesta, vigencia de lecturas, ventana de referencia y regla demostrativa. Validar qué protocolo revisado se puede mostrar, si se incorpora.
2. **Agregar autenticación, persistencia y captura.** Preparar cuentas y misión de demo, aplicar permisos y construir la captura manual y simulada. Verificar que el historial conserva la procedencia.
3. **Completar autoevaluación y respuesta.** Implementar línea base, estado de calidad, explicación del aviso, acciones y revisión. Agregar el contexto de iluminación al historial de sueño.
4. **Integrar y comprobar el ESP32.** Enviar una lectura real, reenviar su identificador para probar deduplicación y cortar la señal para probar vigencia. Mantener el escenario sintético disponible para reproducir el guion.
5. **Validar local y producción.** Ejecutar lint, verificación de tipos y build. Verificar la app local con Internet desconectado. Desplegar desde `main` y probar portada, salud, acceso protegido y flujo de demo en Vercel con datos ficticios.

### Guion de aceptación

1. Entrar como astronauta. Registrar sueño manualmente y comprobar una lectura de pulso del ESP32 con su origen visible.
2. Consultar la iluminación del hábitat durante la noche registrada. Cargar una serie sintética con referencia estable y una desviación sostenida.
3. Abrir el aviso, comprobar su explicación, guardar una nota y solicitar revisión. Entrar con el segundo rol y cerrar el caso con una observación.
4. Ejecutar casos de lectura inválida, referencia insuficiente y corte de ingesta. Desconectar Internet y repetir el inicio de sesión, la captura manual y la consulta en el entorno local.

Los indicadores y escenarios se fundamentan en el [Human Research Roadmap de NASA](https://humanresearchroadmap.nasa.gov/Evidence/) y el [estudio de Inspiration4](https://pmc.ncbi.nlm.nih.gov/articles/PMC11357997/). La entrega debe incluir instrucciones reproducibles, identificación de datos sintéticos y la versión de las reglas de aviso usadas en la demo.
