# NASA Health · Propuesta de MVP para el equipo

**Estado:** propuesta para revisión del equipo.

**Decisión propuesta:** usar Next.js para la interfaz y la API, con PostgreSQL local. Construir primero el flujo completo con un escenario simulado e integrar el ESP32 cuando el equipo pueda verificar el sensor y la transmisión.

## Qué debe demostrar el prototipo

El reto de NASA Space Apps 2026 pide un software que recopile indicadores de salud y permita a los astronautas evaluar su estado y actuar durante una misión. La especificación v0.2 ya contempla captura, historial y avisos. Falta convertir esos avisos en un flujo que el astronauta pueda completar por su cuenta: entender qué cambió, revisar la calidad y el contexto de la lectura, y registrar el siguiente paso. [Reto oficial](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) · [Objetivos ampliados publicados por HackAthlone](https://hackathlone.com/challenges/health-monitoring-software#objectives) · [Especificación v0.2](https://github.com/AMVMesias/NASA_HEALTH/blob/e7d2ac1f25acfee01663027c6c01326d32d101c8/REQUISITOS_NASA_HEALTH.md)

La demo se centrará en orientación operativa: verificar una lectura, repetirla cuando proceda, documentar contexto y solicitar revisión. Si el equipo quiere ilustrar la orientación sobre tratamientos que menciona el objetivo ampliado, puede incorporar la consulta de un protocolo previamente revisado para el escenario. Las reglas y los avisos de la demo se identificarán como demostrativos y sin validación clínica.

## Alcance y aceptación

| Capacidad | Alcance propuesto | Se acepta cuando… |
| --- | --- | --- |
| Acceso | Una cuenta de astronauta, una misión y un módulo precargados. | La cuenta consulta su propio historial. Las solicitudes sin autorización se rechazan tanto en la web como en la API. |
| Captura | Sueño en horas y bienestar en una escala definida, ambos manuales. Frecuencia cardíaca en reposo en latidos por minuto, mediante simulación y opcionalmente ESP32. | Cada medición muestra quién la registró o qué dispositivo la envió, su origen, unidad, hora de captura y calidad. |
| Autoevaluación | Tendencia frente a una referencia individual calculada con lecturas válidas y comparables. | El astronauta ve el período de referencia, el cambio y la regla aplicada. Si faltan lecturas comparables, aparece «Datos insuficientes». |
| Contexto ambiental | Iluminación simulada del módulo junto al historial de sueño. | El astronauta selecciona una noche y ve qué iluminación coincidió con ese período. La pantalla describe la coincidencia temporal y permite aportar contexto. |
| Acción | Detalle del aviso, siguiente paso y registro de seguimiento. | Una lectura inválida permite registrar su repetición. Una variación sostenida permite añadir una nota y dejar el aviso pendiente de revisión. Cada acción conserva autor y hora. |
| Operación local | Aplicación y base de datos en el portátil de la demo, con red local para el ESP32 si se incorpora. | Sin Internet funcionan login, captura manual e historial. Si se corta la ingesta, el tablero conserva la última lectura e indica su antigüedad. |

La interfaz puede resolverse con tres vistas: inicio de sesión, tablero personal con captura e historial, y detalle del aviso. Administración avanzada, informes exportables, múltiples misiones, sincronización con Tierra y gamificación quedan para fases posteriores.

### Cómo encajan los datos de cabina

La **referencia personal** describe el comportamiento habitual del astronauta en condiciones comparables. La **telemetría ambiental** describe el módulo donde se encontraba en ese momento. Cada lectura ambiental debe guardar módulo, hora, variable, unidad y origen. Mostrar ambas series en una línea de tiempo permite revisar coincidencias sin atribuir una causa automáticamente.

Para el MVP basta con iluminación y sueño. El mismo modelo puede incorporar presión de cabina, concentración de oxígeno, CO₂, temperatura o humedad. La presión de cabina se interpreta junto con la composición del aire. Si se incorpora radiación ionizante, su dosis requiere dosimetría específica. Una lectura UV representa una exposición distinta. [NASA, condiciones ambientales](https://www.nasa.gov/reference/6-0-natural-and-induced-environments-vol-2/) · [NASA, iluminación y ritmo circadiano](https://www.nasa.gov/human-rating-guidance/) · [Agencia Espacial Canadiense, dosimetría](https://www.asc-csa.gc.ca/eng/astronauts/space-medicine/projects-radiation.asp)

## Arquitectura propuesta

| Opción | Ventajas y coste para el MVP |
| --- | --- |
| **Next.js App Router + PostgreSQL** | Un servicio de aplicación. Los Route Handlers reciben HTTP del ESP32, mientras la interfaz y el simulador pueden reutilizar los mismos módulos de servidor. Reduce el trabajo de despliegue local y permite probar el flujo completo en un solo repositorio. |
| **Next.js + NestJS + PostgreSQL** | API independiente con módulos, controladores y servicios explícitos. Añade un servicio que arrancar y un contrato que coordinar con la web. Conviene si el equipo ya tiene una base NestJS reutilizable o necesita desplegar la API y la ingesta de forma independiente. |

Con el alcance descrito, **la recomendación es Next.js para frontend y backend**. Un ESP32 que envía lecturas por HTTP en la red local puede conectarse a un Route Handler. La decisión merece revisarse si la ingesta requiere un servicio propio, procesos de larga duración o un ciclo de despliegue distinto de la web. [Next.js, Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) · [NestJS, controladores](https://docs.nestjs.com/controllers)

```text
Captura manual ─────────────────────┐
Simulador ──────────────────────────┼─► Servicio de mediciones ─► PostgreSQL
ESP32 por Wi-Fi local ─► API HTTP ──┘           │
                                               └─► Reglas de aviso
                                                      │
                                        Tablero y registro de acciones
```

- **Ingesta.** El endpoint propuesto es `POST /api/v1/measurements`. Validar credencial del dispositivo, indicador, unidad y hora. Usar un identificador único de lectura por dispositivo para evitar duplicados por reintentos. El formulario usa la sesión del astronauta.
- **Persistencia.** Guardar hora de captura y hora de recepción en UTC. Modelar mediciones personales, lecturas ambientales, referencias individuales, avisos y acciones asociadas. Guardar con cada aviso el motivo y la versión de la regla.
- **Actualización.** Evaluar variaciones al guardar lecturas válidas. Para la demo, calcular la antigüedad al consultar el tablero y usar consultas periódicas. Esto permite verificar una interrupción sin montar un proceso de monitoreo continuo.
- **Entorno local.** Preparar un arranque reproducible con base de datos y datos iniciales. Aplicación, autenticación y recursos visuales deben estar disponibles localmente. Antes de la demo, probar por separado la pérdida de Internet y la pérdida del enlace con el ESP32.

## Cambios a la especificación v0.2

1. **RF-20 a RF-25.** Añadir captura manual, referencia individual, contexto de medición y estado de datos insuficientes.
2. **RF-31 a RF-36.** Añadir motivo del aviso, acción sugerida, estado de revisión y trazabilidad. Definir con ejemplos las condiciones de apertura y cierre.
3. **RF-14 a RF-19 y RH-01 a RH-08.** Acordar si el ESP32 es obligatorio para la primera entrega. Si queda como extensión, actualizar la prioridad de esos requisitos y conservar el contrato de ingesta para cuando esté disponible.
4. **Secciones 6 y 7.** Añadir telemetría ambiental por módulo y acciones de seguimiento. Registrar la decisión sobre Next.js y NestJS después de revisarla en equipo.
5. **Secciones 8 y 9 y RNF-11.** Fijar por indicador la unidad o escala, fuente, período de referencia, frecuencia esperada y antigüedad máxima. Convertir la tabla de aceptación en casos de prueba.

## Orden de trabajo y guion de la demo

1. **Cerrar las decisiones del equipo.** Confirmar stack, indicadores, escala de bienestar, regla demostrativa y disponibilidad del ESP32 y del sensor. Si se incluye hardware, confirmar protocolo, red receptora y formato antes de desarrollar el firmware.
2. **Construir el flujo completo con datos simulados.** Iniciar sesión, cargar una referencia estable, registrar sueño y mostrar una desviación sostenida en frecuencia cardíaca. Abrir el aviso, mostrar el motivo, guardar una nota y marcarlo para revisión.
3. **Incorporar el contexto ambiental.** Mostrar una noche corta junto a la iluminación simulada de ese período. Permitir que el astronauta revise ambas series y registre contexto.
4. **Verificar el comportamiento ante fallos.** Ejecutar casos de referencia insuficiente, lectura inválida, reintento de ingesta y dato desactualizado. Repetir la captura manual y la consulta con Internet desconectado.
5. **Integrar el ESP32 si está listo y preparar la entrega.** Verificar una lectura de punta a punta y preparar instrucciones de arranque, un escenario reiniciable y las fuentes que fundamentan la demo.

Los informes del Human Research Program sirven para justificar los indicadores. El estudio de Inspiration4 aporta un ejemplo de seguimiento con dispositivos portátiles y documenta lecturas de saturación faltantes en vuelo. Se propone usarlo para diseñar escenarios y etiquetar claramente las series sintéticas de la demo. [NASA, informes de evidencia](https://humanresearchroadmap.nasa.gov/Evidence/) · [Estudio de Inspiration4](https://pmc.ncbi.nlm.nih.gov/articles/PMC11357997/)
