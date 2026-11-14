# Análisis del catálogo ambiental y uso en NASA Health

Fecha: 14 de noviembre de 2026. Archivo revisado: [space_environment_surface_EVA_verified.json](src/backend/application/health/space_environment_surface_EVA_verified.json).

## Resultado del análisis

El archivo es una **base documental de referencias y conectores**, útil para preparar fichas ambientales y perfiles seleccionables. No es un generador de datos, una serie de telemetría, un esquema formal de validación ni un modelo fisiológico. Su campo `verification` declara que no se comprobaron descargas en vivo y que no hay series embebidas. El nombre `verified` no sustituye la validación científica de cada entrada ni las pruebas de cada conector.

Se comprobó localmente que el JSON se puede parsear, contiene cuatro escenarios, 30 entradas ambientales, 15 fuentes y ocho conectores; todas las referencias de fuentes y escenarios usadas por variables, listas de fuentes y conectores existen. Nueve entradas ambientales tienen valor `null`. Esta comprobación es estructural; no vuelve a verificar las cifras contra las publicaciones enlazadas.

| Escenario | Qué permite mostrar ahora | Qué no entrega |
| --- | --- | --- |
| `deep_space_transit` | Rangos radiológicos publicados de Orion/Artemis I y explicación de contexto | Crucero interplanetario observado, microclima de cabina o dosis personal |
| `iss_leo` | Referencias de comparación de radiación de un período y fuentes EDA/RadLab | Temperatura, humedad, CO₂ o presión medidos en un instante concreto |
| `moon_surface` | Gravedad, referencias térmicas/exosféricas y radiación instrumental LND | Interior de base/traje, dosis personal o serie horaria |
| `mars_surface` | Gravedad, referencias atmosféricas, viento y radiación RAD | Estado actual en Jezero, interior de base/traje o datos biométricos |

## Aspectos que deben resolverse antes de importar

1. **Ámbito por variable.** `scope` describe exteriores lunares/marcianos, aunque el archivo también incluye ISS y nave. Los campos `setting` son descriptivos; normalizarlos. Separar ubicación del instrumento, objeto medido y contexto de exposición: Orion/ISS interior, superficie/aire/exosfera exterior e instrumento radiológico no son intercambiables.
2. **Representatividad del tránsito.** El ID `deep_space_transit` se puede conservar por compatibilidad, pero su evidencia Orion corresponde a una misión lunar de referencia. No presentarla como una medición de viaje a Marte; conservar misión y alcance en la ficha.
3. **Versionado.** `schema_version: 1.1.0` identifica formato y `prepared_on` fecha de preparación; faltan versión inmutable de contenido/perfil y checksum. Una edición de valores debe crear una nueva revisión, sin sobrescribir la citada por mediciones antiguas.
4. **Tipos y unidades.** `value` admite escalar, rango y `null`. Ocho entradas carecen de campo `unit`, aunque algunas sugieren unidad en su nombre. Normalizar con un mapeo explícito, no por heurística. Conservar también dato/unidad originales; validar números finitos y `min ≤ max`.
5. **Ausencia.** `null` es desconocido. No usar cero, media del rango o ruido aleatorio para rellenarlo. Motivo de ausencia y procedencia son parte del DTO.
6. **Referencias frente a observaciones.** Los campos requeridos para registros importados no describen las referencias actuales: no inventar `observed_at` usando `prepared_on`. Una referencia puede tener período no especificado; una observación exige fecha original, instrumento, sitio y calidad verificables.
7. **Conectores.** Los ocho están marcados `tested_live: false`. Revisar endpoints y documentos de producto antes de activarlos; confirmar unidades que EDA deja pendientes. La consulta RadLab incluye un filtro `absorbed_dose_rate>2`: no usar ese ejemplo como serie completa ni para calcular promedios representativos sin justificar el sesgo de selección.
8. **Radiación.** Mantener componente GCR/total/neutro, tasa/acumulado, material detector y blindaje contextual. No sumar componente neutra al total que ya la incluye, ni convertir Gy a Sv con una constante arbitraria. No asignar tasas instrumentales como exposición personal.
9. **Salud y traje.** Conservar las restricciones ya incluidas. `quantitative_physiological_effect`, `personal_dose` y medidas internas son `null`; no crear funciones que los rellenen desde gravedad, CO₂ o temperatura exterior. DONKI describe eventos, no dosis local; OLTARIS requiere un modelo adicional y queda fuera de la entrega mínima.

## Modelo de integración propuesto

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

## Uso en frontend

- Selector de los cuatro escenarios con nombres que reflejen cabina o exterior/EVA.
- Ficha «Referencias ambientales» con fuente, unidad, rango/promedio, contexto y revisión. La fecha de preparación no aparece como fecha de última lectura.
- Bloque separado «Telemetría ambiental»: inicialmente «Sin datos importados»; después muestra instrumento, fecha original y calidad.
- Indicadores personales muestran origen real/manual/sintético y contexto de actividad; nunca se completan a partir del JSON.
- La iluminación simulada de sueño procede de un fixture separado por módulo y período. Seleccionar Marte no genera automáticamente iluminación, sueño o pulso.

## Entrega por hitos

1. Validación, mapeo de unidades/ámbitos, versiones de contenido y contratos compartidos.
2. Catálogo offline, semillas repetibles, selector y fichas con ausencia explícita.
3. Captura personal con asignación histórica y versión conservada en cola.
4. Importación manual reproducible de un lote ISS/EDA y uno Marte/MEDA: conservar archivo original, checksum, producto, fecha y transformaciones; rechazar duplicados/conflictos según ID estable acordado.
5. Integración y pruebas de captura, evaluación y recepción cloud sin confundir referencias, lecturas y simulación. Ampliar Diviner/radiación cuando los importadores y unidades estén verificados.

Este cambio ajusta la planificación; no implica que el cargador, las tablas, los conectores ni el selector ya estén implementados. Los detalles de ejecución y responsabilidades están en [PLAN_BACKEND_MVP.md](PLAN_BACKEND_MVP.md) y [PLAN_EJECUCION_PERSONA_1.md](PLAN_EJECUCION_PERSONA_1.md).
