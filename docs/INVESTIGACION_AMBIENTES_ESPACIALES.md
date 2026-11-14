# NASA Health · Evidencia para simular ambientes espaciales

Consulta: 14 de noviembre de 2026. Alcance: investigación documental para diseñar escenarios; no se han descargado ni validado series completas ni implementado un modelo fisiológico.

## 1. Qué pide el reto y qué pudo verificarse

El reto pide recopilar indicadores y permitir que el astronauta evalúe su salud y actúe. Vincula las misiones largas con radiación, confinamiento, gravedad alterada y ambiente cerrado hostil. Esto respalda combinar mediciones personales, contexto y seguimiento. [Página del reto](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/).

La URL con `?tab=resources` y la apertura directa devolvieron errores durante la consulta. Se recuperó el objetivo mediante la versión indexada, pero **no se verificó la lista completa de esa pestaña**. Una discusión del repositorio del evento describe recursos HRP/CSA y la dificultad de encontrar un dataset fisiológico unificado; es contexto comunitario, no una especificación científica ni confirmación de acceso a datos. [Discusión del 13 de noviembre](https://github.com/nasa/spaceapps/discussions/2025).

Las fuentes siguientes se verificaron independientemente del reto. Se priorizaron NASA, archivos PDS, publicaciones originales y equipos de instrumentos.

## 2. Separación necesaria de los ambientes

El selector puede presentar cuatro destinos, pero cada uno necesita ámbitos distintos:

| Escenario | Exterior | Entorno que experimenta el astronauta |
| --- | --- | --- |
| Tránsito por espacio interplanetario | Vacío, radiación, iluminación y flujos térmicos según trayectoria | Cabina presurizada durante tránsito; traje durante EVA |
| Estación espacial tipo ISS | Órbita terrestre; exterior expuesto | Cabina con soporte vital y microgravedad; traje en EVA |
| Base en la superficie lunar | Exosfera muy tenue, suelo, iluminación, polvo y radiación | Hábitat presurizado o traje; gravedad lunar |
| Base en la superficie de Marte | Atmósfera tenue de CO₂, meteorología, polvo y radiación | Hábitat presurizado o traje; gravedad marciana |

«Estación lunar» se interpreta aquí como base en superficie. Una estación en órbita lunar necesita otro perfil: no se le asigna automáticamente gravedad superficial. La microgravedad describe caída libre y aceleración residual, no ausencia de campo gravitatorio.

Esta separación es una decisión de modelado: la temperatura exterior no es la corporal ni la de cabina; el CO₂ de Marte no es el aire respirado dentro del hábitat.

## 3. Referencias físicas reales

### Luna

- Gravedad aproximada: un sexto de la terrestre, alrededor de 1.62 m/s².
- Temperatura superficial ilustrativa: aproximadamente +127 °C bajo iluminación y −173 °C en oscuridad. Son referencias de superficie, no una curva universal ni temperatura del aire.
- Ciclo solar aproximado: 29.5 días terrestres; las condiciones polares y las sombras dependen del terreno. [NASA, Moon Facts](https://science.nasa.gov/moon/facts/).
- En zonas de sombra permanente se han medido temperaturas inferiores a −246 °C. No mezclar ese extremo polar con una serie ecuatorial. [NASA, Weather on the Moon](https://science.nasa.gov/moon/weather-on-the-moon/).
- Chang'e-4/LND estimó una dosis equivalente media de **1.369 mSv/día** para su ubicación/período y condiciones instrumentales. No representa la dosis dentro de cualquier base lunar. [Zhang et al., 2020, estudio original](https://pmc.ncbi.nlm.nih.gov/articles/PMC7518862/), DOI: 10.1126/sciadv.aaz1334.

Para simulación: elegir latitud, longitud, terreno, hora solar y fase de misión. Representar presión exterior como «vacío aproximado/exosfera», con `null` si falta una medida o modelo numérico, en lugar de inventar una presión exacta cero.

### Marte

| Variable | Referencia | Interpretación |
| --- | --- | --- |
| Gravedad superficial media | 3.73 m/s², aproximadamente 0.38 g | Valor medio; no implica una respuesta fisiológica proporcional |
| Presión al radio medio | 636 Pa = 0.636 kPa = 6.36 mbar | Referencia dependiente de elevación y estación |
| Variación estacional indicada | 400–870 Pa | No es el rango de todos los lugares |
| Composición por volumen | CO₂ 95.1%; N₂ 2.59%; Ar 1.94%; O₂ 0.16% | Atmósfera exterior no respirable |
| Temperatura atmosférica media indicada | Cerca de −59 °C | No sustituye datos horarios locales |
| Ejemplo diurno de Viking 1 | −89 a −31 °C | Contexto específico del sitio |
| Sol | Aproximadamente 24 h 39 min 35 s | Día solar marciano |
| Irradiancia solar de referencia | 586.2 W/m² | No equivale a flujo real sobre cualquier superficie |

Fuente de la tabla: [NASA, Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html). Las cifras corresponden a esa ficha; otras publicaciones redondean o usan sitios/períodos distintos.

Las mediciones RAD durante crucero y superficie se han resumido alrededor de **1.8 mSv/día** y **0.6 mSv/día**, respectivamente. Son referencias de misiones concretas, sensibles a actividad solar, material alrededor del detector y atmósfera. [Estudio de observaciones de neutrones y RAD, 2019](https://www.sciencedirect.com/science/article/pii/S0032063318304574).

### Espacio interplanetario

No asignar una «temperatura del espacio» única como temperatura ambiente respirada. Se requiere distinguir temperatura de superficies, radiación incidente, orientación y sombra. NASA describe intercambio térmico por radiación y conducción, sin convección en el vacío. [NASA, Thermal Control](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/).

Para el prototipo, modelar tránsito en caída libre, soporte vital de cabina y radiación como contexto separado. La referencia RAD de crucero anterior corresponde al interior de una nave concreta; no es una medición universal del vacío sin blindaje.

### Cabina ISS y traje EVA

Una publicación técnica NASA presenta como referencias de ISS presión de 14.7 psi (aproximadamente 101.3 kPa), presión parcial de oxígeno de 3.1 psi y temperatura de aire de 17–28 °C. Son valores de referencia de esa publicación, no una serie de telemetría ni objetivos actuales de todas las misiones. [NASA, ISS Technology Demonstration](https://www.nasa.gov/wp-content/uploads/2023/08/np-2022-06-009-jsc-iss-tech-demo-mini-book-proof-3.pdf).

El traje EMU tiene una referencia histórica de operación de 4.3 psi, aproximadamente 29.6 kPa, con oxígeno al 100%. **No trasladar ese valor automáticamente a trajes lunares o marcianos ni aplicar límites de cabina al traje.** [NASA, Spacesuits](https://www.nasa.gov/podcasts/houston-we-have-a-podcast/spacesuits/).

## 4. Estándar vigente que debe versionarse

Se verificó **NASA-STD-3001, volumen 2, revisión F**, aprobada el 14 de julio de 2026; sustituye la revisión E. [Registro oficial](https://standards.nasa.gov/standard/NASA/NASA-STD-3001_VOL_2).

Referencias para reglas ambientales del prototipo:

| Requisito | Referencia y ámbito |
| --- | --- |
| V2 6004 | ppCO₂ media de una hora ≤3 mmHg en volumen habitable |
| V2 6012 | Temperatura/humedad de cabina se evalúan conjuntamente con la envolvente de la figura 6.2-2 |
| V2 6053 | Polvo lunar <10 µm: promedio ponderado <0.3 mg/m³, exposición diaria intermitente hasta seis meses |
| V2 6253 | Polvo marciano <10 µm: promedio ponderado <0.1 mg/m³, escenarios de exposición hasta 30 días |

[Texto completo, revisión F, secciones 6.2.1.3, 6.2.3.1 y 6.2.8.3–4](https://www.nasa.gov/wp-content/uploads/2025/05/nasa-std-3001-vol-2.pdf).

Estos requisitos tienen ámbito y duración: no convertirlos en umbrales instantáneos genéricos ni certificados de seguridad. La envolvente térmica exige revisar su figura antes de programarla; no reducirla a dos intervalos independientes. El polvo lunar y marciano requiere métodos de medición apropiados, no un sensor ambiental genérico sin calibración.

Conversión para el software, derivada de unidades y ley de Dalton:

- `ppCO2_kPa = pressure_kPa × co2_ppm / 1_000_000`.
- `ppCO2_mmHg = ppCO2_kPa / 0.133322`.
- A 101.3 kPa, 3 mmHg equivalen aproximadamente a 3950 ppm; a otra presión cambia la equivalencia.
- `ppO2_kPa = pressure_kPa × oxygen_fraction` describe el gas seco; **no es** presión inspirada humidificada ni saturación sanguínea SpO₂.

Guardar ventana, cobertura y huecos para todo promedio ponderado. Si faltan datos suficientes, mostrar «evaluación incompleta» en vez de declarar cumplimiento.

## 5. Efectos en humanos y límites de lo que se puede inferir

NASA agrupa los peligros en radiación, aislamiento/confinamiento, distancia de la Tierra, cambios gravitatorios y ambiente cerrado hostil. Sus efectos pueden interactuar. [NASA HRP, cinco peligros](https://www.nasa.gov/hrp/hazards/).

| Exposición | Evidencia humana o mecanismo | Qué puede registrar NASA Health |
| --- | --- | --- |
| Microgravedad prolongada | Pérdida de carga musculoesquelética; NASA describe pérdida de densidad ósea de 1–1.5% mensual en misiones de cuatro a seis meses, con variación individual | Tiempo de misión, ejercicio, dolor y contexto; no estimar densidad ósea a partir del pulso |
| Redistribución de fluidos | Cambios oculares y cerebrales asociados al vuelo, agrupados como SANS; mecanismos aún investigados | Síntomas visuales declarados y seguimiento; no diagnosticar SANS con sensores básicos |
| Sueño/ritmo circadiano | La ISS presenta unos 16 amaneceres diarios; horarios, iluminación y carga operativa pueden alterar el sueño | Sueño, horarios, iluminación real de cabina y bienestar |
| CO₂ de cabina elevado | NASA documenta asociación entre exposición y cefalea en datos de ISS | ppCO₂, ventana de exposición, cefalea declarada; no concluir causalidad individual |
| Polvo celeste | Irritación respiratoria/ocular en Apollo; posibles daños respiratorios, cutáneos y cardiovasculares bajo estudio | Evento de entrada desde EVA, partículas por fracción de tamaño, síntomas y contexto |
| Radiación ionizante | Aumento de riesgos a largo plazo, incluido cáncer; otras consecuencias dependen de dosis y exposición | Tasa y dosis acumulada con instrumento/modelo y calidad; no predecir cáncer o pulso a partir de una tasa ambiental |
| Aislamiento/carga de trabajo | Estrés, sueño insuficiente y problemas de desempeño forman parte de los riesgos investigados | Bienestar subjetivo, descanso y carga declarada |

Fuentes por tema: [hueso](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/), [SANS](https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/), [sueño](https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/), [CO₂](https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/), [polvo](https://www.nasa.gov/directorates/esdmd/hhp/risk-of-adverse-health-performance-effects-of-celestial-dust-exposure/), [riesgos HRP](https://www.nasa.gov/hrp/risks/).

La exposición prolongada humana a gravedad lunar o marciana sigue teniendo vacíos de evidencia directa. Trabajos de NASA anticipan riesgos basándose en evidencia indirecta; no permiten calcular una pérdida ósea lunar multiplicando la tasa de ISS por 1/6, ni la marciana por 0.38. [NASA Ames, investigación sobre gravedad parcial](https://ntrs.nasa.gov/citations/20210019591).

Tampoco existe en estas fuentes una función validada que convierta destino + temperatura exterior en pulso, SpO₂, horas de sueño o bienestar. Un escenario fisiológico sintético debe declararse como guion de demostración.

## 6. Dónde obtener series reales

| Fuente primaria | Qué ofrece y uso propuesto | Cuidado al incorporar |
| --- | --- | --- |
| [NASA OSDR Environmental Data App](https://visualization.osdr.nasa.gov/eda/) | Temperatura, humedad, CO₂ y radiación de misiones ISS; tablas descargables brutas y resumidas | Distinguir cabina, hardware experimental y control terrestre; una serie de experimento con roedores no es un registro fisiológico humano |
| [PDS MEDA, Perseverance](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda_11282022.html) | Presión, temperatura de aire/superficie, humedad, viento, polvo y radiación UV/visible/IR de Jezero; productos calibrados y derivados | Fijar sol y ubicación, detector, flags y versión; UV/IR no es dosis ionizante |
| [MEDA, descripción de productos](https://an.rsl.wustl.edu/help/Content/About%20the%20data/Data%20sets/M20/MEDA%20bundle.htm) | Documenta presión en mbar, temperaturas en K, flujo W/m² y otras unidades | Convertir explícitamente; conservar etiqueta PDS4 y diferencia entre calibrado y modelado |
| [LRO Diviner, archivo PDS](https://pds-geosciences.wustl.edu/missions/lro/diviner.htm) | Radiometría y productos térmicos de superficie lunar, mapas y registros calibrados | Temperatura de brillo/suelo no es aire; el archivo documenta faltantes `-9999`, que deben convertirse a ausencia |
| [Equipo Diviner, UCLA](https://www.diviner.ucla.edu/data) | Acceso al archivo y productos del instrumento | Seleccionar producto, resolución y zona; no tratar todo mapa como sensor local |
| [Inspiration4, estudio original](https://www.nature.com/articles/s41586-024-07648-x) | Mediciones fisiológicas y datos de wearables en cuatro participantes; cambios individuales en frecuencia cardíaca y HRV | Misión corta y muestra pequeña; revisar disponibilidad y condiciones de cada dato; no asumir que todos los datos personales son de acceso abierto |

El primer lote debería ser pequeño: un período de ISS y uno o varios soles MEDA con buena cobertura. Este informe localiza fuentes y referencias; aún no constituye ese lote descargado. Para Luna, comenzar con un producto térmico regional identificado y la referencia publicada LND, sin fabricar una serie histórica de radiación.

## 7. Catálogo ambiental que usa el backend

El archivo es una **base documental de referencias y conectores**, útil para preparar fichas ambientales y perfiles seleccionables. No es un generador de datos, una serie de telemetría, un esquema formal de validación ni un modelo fisiológico. Su campo `verification` declara que no se comprobaron descargas en vivo y que no hay series embebidas. El nombre `verified` no sustituye la validación científica de cada entrada ni las pruebas de cada conector.

Se comprobó localmente que el JSON se puede parsear, contiene cuatro escenarios, 30 entradas ambientales, 15 fuentes y ocho conectores; todas las referencias de fuentes y escenarios usadas por variables, listas de fuentes y conectores existen. Nueve entradas ambientales tienen valor `null`. Esta comprobación es estructural; no vuelve a verificar las cifras contra las publicaciones enlazadas.

| Escenario | Qué permite mostrar ahora | Qué no entrega |
| --- | --- | --- |
| `deep_space_transit` | Rangos radiológicos publicados de Orion/Artemis I y explicación de contexto | Crucero interplanetario observado, microclima de cabina o dosis personal |
| `iss_leo` | Referencias de comparación de radiación de un período y fuentes EDA/RadLab | Temperatura, humedad, CO₂ o presión medidos en un instante concreto |
| `moon_surface` | Gravedad, referencias térmicas/exosféricas y radiación instrumental LND | Interior de base/traje, dosis personal o serie horaria |
| `mars_surface` | Gravedad, referencias atmosféricas, viento y radiación RAD | Estado actual en Jezero, interior de base/traje o datos biométricos |

### Criterios para interpretar e importar datos

1. **Ámbito por variable.** `scope` describe exteriores lunares/marcianos, aunque el archivo también incluye ISS y nave. Los campos `setting` son descriptivos; normalizarlos. Separar ubicación del instrumento, objeto medido y contexto de exposición: Orion/ISS interior, superficie/aire/exosfera exterior e instrumento radiológico no son intercambiables.
2. **Representatividad del tránsito.** El ID `deep_space_transit` se puede conservar por compatibilidad, pero su evidencia Orion corresponde a una misión lunar de referencia. No presentarla como una medición de viaje a Marte; conservar misión y alcance en la ficha.
3. **Versionado.** `schema_version: 1.1.0` identifica formato y `prepared_on` fecha de preparación; faltan versión inmutable de contenido/perfil y checksum. Una edición de valores debe crear una nueva revisión, sin sobrescribir la citada por mediciones antiguas.
4. **Tipos y unidades.** `value` admite escalar, rango y `null`. Ocho entradas carecen de campo `unit`, aunque algunas sugieren unidad en su nombre. Normalizar con un mapeo explícito, no por heurística. Conservar también dato/unidad originales; validar números finitos y `min ≤ max`.
5. **Ausencia.** `null` es desconocido. No usar cero, media del rango o ruido aleatorio para rellenarlo. Motivo de ausencia y procedencia son parte del DTO.
6. **Referencias frente a observaciones.** Los campos requeridos para registros importados no describen las referencias actuales: no inventar `observed_at` usando `prepared_on`. Una referencia puede tener período no especificado; una observación exige fecha original, instrumento, sitio y calidad verificables.
7. **Conectores.** Los ocho están marcados `tested_live: false`. Revisar endpoints y documentos de producto antes de activarlos; confirmar unidades que EDA deja pendientes. La consulta RadLab incluye un filtro `absorbed_dose_rate>2`: no usar ese ejemplo como serie completa ni para calcular promedios representativos sin justificar el sesgo de selección.
8. **Radiación.** Mantener componente GCR/total/neutro, tasa/acumulado, material detector y blindaje contextual. No sumar componente neutra al total que ya la incluye, ni convertir Gy a Sv con una constante arbitraria. No asignar tasas instrumentales como exposición personal.
9. **Salud y traje.** Conservar las restricciones ya incluidas. `quantitative_physiological_effect`, `personal_dose` y medidas internas son `null`; no crear funciones que los rellenen desde gravedad, CO₂ o temperatura exterior. DONKI describe eventos, no dosis local; OLTARIS requiere un modelo adicional y queda fuera de la entrega mínima.

### Modelo de integración

Crear cuatro recursos distintos, con nombres de tablas definitivos a decidir en migraciones:

| Recurso | Contenido | Uso |
| --- | --- | --- |
| Catálogo documental | Fuentes y referencias escalares/rangos, evidencia, contexto, revisión y checksum | Fichas consultables offline |
| Perfil y asignación | Escenario, versión, ámbito, misión/módulo, actividad e intervalo efectivo por astronauta | Contexto histórico de captura |
| Observación ambiental | Fecha original, variable, unidad, instrumento, ubicación, calidad, producto y transformaciones | Historial ambiental real o reproducción histórica |
| Medición personal | Dueño, indicador, origen y contexto ambiental referenciado | Captura, evaluación personal y sincronización del MVP |

El adaptador de infraestructura carga el JSON, valida estructura y referencias, y lo transforma al contrato del dominio. El caso de uso consulta ese contrato; no depende de nombres de propiedades como `exterior_viking1_diurnal_air_temperature_range`. Mantener el archivo original y su checksum permite auditar la transformación.

Una semilla idempotente inserta escenarios/referencias por ID y revisión. Si encuentra mismo ID/revisión con contenido distinto, falla explícitamente. La nube recibe el mismo catálogo versionado antes de aceptar mediciones que lo referencian; no sincronizar automáticamente fuentes/observaciones por la cola personal existente.

La selección debe conservar intervalos efectivos sin solapamientos por astronauta y contexto de actividad. Un registro de ayer consulta la asignación de ayer, no la actual; si falta, informar el error o pedir contexto explícito validado. No impedir una medición por ausencia de telemetría cuando sí existe un perfil válido.

Fuente del catálogo: [space_environment_surface_EVA_verified.json](../data/space_environment_surface_EVA_verified.json). El cargador y las asignaciones históricas están implementados. El selector en el tablero y las importaciones EDA/MEDA quedan pendientes.

## 8. Datos mínimos para implementarlo

Propuesta de contrato, pendiente de coordinar con los dos responsables:

- **Perfil:** ID, versión, destino, ámbito (`exterior`, `cabin`, `suit`), misión/módulo, ubicación y período efectivo.
- **Variable:** nombre, unidad, valor/rango, tipo (`measured`, `published_reference`, `modeled`, `synthetic`), origen y calidad.
- **Procedencia:** URL/DOI, instrumento, producto/versión, sitio, fecha original, fecha de consulta e incertidumbre cuando esté publicada.
- **Lectura:** captura/recepción UTC, hora solar/sol cuando aplique, resolución, cobertura, estado de ausencia y transformación aplicada.
- **Regla:** versión de estándar, requisito, ámbito, ventana, unidades, cobertura mínima y límites de aplicabilidad.
- **Exposición personal:** astronauta, intervalo, cabina/traje, actividad, contexto y referencia a telemetría; no asumir presencia por coincidencia de misión.

Guardar `null` más un motivo para desconocidos; nunca sustituir ausencia por cero. Los valores de referencia publicados no deben presentarse como telemetría en vivo. Una reproducción histórica conserva sus fechas originales además del reloj de reproducción.
