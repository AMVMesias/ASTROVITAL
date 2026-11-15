# DSS de telemetría: integración del parche v2

Se integraron el motor, las pruebas y los resúmenes aportados en `/home/grimroot/Desktop/ASTROVITAL_DSS_V2_PATCH` con la aplicación actual de Supabase y Next.js. El dashboard del parche correspondía a una versión anterior: se incorporó su panel como componente nuevo y se conservaron las gráficas, BLE web, caducidad, sesiones y seguimiento de avisos existentes.

## Uso

Iniciar backend y frontend con `npm run dev:backend` y `npm run dev:frontend`. Iniciar sesión como astronauta y abrir `/dashboard`: el panel **Sensores y entorno de misión** permite seleccionar escenario y consulta el DSS cada 15 segundos, después de una captura y mediante el botón de actualización. También se puede seleccionar el entorno en `/entorno`.

La ruta **GET `/api/v1/me/dss`**, documentada en Swagger, usa la cookie HttpOnly, exige primer acceso completo y rol astronauta. No acepta identificadores de otro usuario. Sin asignación ambiental devuelve `409 ENVIRONMENT_MISSING`, en lugar de asumir ISS. Reutiliza las tablas de telemetría y de asignaciones de Supabase; no necesita nuevas migraciones ni servicios adicionales.

## Datos y reglas

- Consulta hasta 100 instantáneas del astronauta, posteriores al comienzo de la asignación activa y anteriores al reloj de la consulta. Regresar al mismo escenario inicia un intervalo nuevo.
- Reutiliza la revisión del perfil realmente asignado, sin reemplazarla por la revisión actual del archivo.
- La última muestra caduca a los **30 segundos**, coherente con `demoRules.heart_rate`. La ventana histórica de tendencias es de **120 segundos**; esto no vuelve vigente una muestra antigua.
- Analiza SpO2, frecuencia ECG, pulso del oxímetro y frecuencia respiratoria únicamente cuando el estado del firmware y los rangos de formato lo permiten. Los ceros sin contacto son indisponibles, nunca oxigenación o pulso reales de cero.
- Excluye muestras futuras, IDs duplicados y otros dispositivos en la tendencia. Un estado posterior de desconexión invalida estimaciones del dispositivo; una pérdida posterior de señal ECG invalida su pulso.
- Conserva los umbrales demostrativos del parche: SpO2 menor de 90 produce prioridad de verificación; de 90 a menos de 95 produce revisión; discrepancias de pulso de 20 lpm y cambios observados de pulso de 20 lpm generan revisión. **Son decisiones configuradas del prototipo, sin validación clínica ni certificación NASA/EVA**. No sustituyen los avisos existentes ni se guardan como nuevos diagnósticos.
- Las instantáneas consecutivas pueden repetir la misma estimación del firmware; no equivalen a latidos ni mediciones clínicas independientes. Las tendencias no constituyen una referencia clínica personal.

Los textos explicativos del motor aportado están en español. Los controles del panel conservan las etiquetas de navegación ES/EN del producto. Los resultados incluyen versión de reglas, fecha, antigüedad, evidencia y limitaciones.

## Presentación y fallos

Los valores caducados se muestran sin valor vigente. El panel recalcula antigüedad mientras está abierto; un fallo de red no mantiene indefinidamente una conclusión vigente. Conserva el resultado anterior fechado con aviso de error y elimina su interpretación actual al caducar. Un cambio de escenario descarta el análisis anterior y no permite que una respuesta atrasada lo reponga. La consulta no modifica las mediciones ni crea avisos automáticamente.

## Radiación: procedencia y límites

`data/radlab_reference_summaries.json` incorpora los tres resúmenes históricos y la ausencia de serie ISS del parche. Suma **353927 registros reportados**. No se incluyeron los CSV originales, sus hashes ni el procedimiento completo de cálculo: los conteos, fechas, unidades, medianas y percentiles son **aportados, no recalculados ni verificados de forma independiente**. La API y el panel exponen esa procedencia (`supplied_not_reproduced`). No se presentan como nueva telemetría en vivo.

CRaTER se etiqueta como órbita lunar y no superficie; la referencia Orion y la del detector Curiosity no representan dosis personales universales. Ninguna cifra radiológica modifica el estado fisiológico ni se transforma en un límite de seguridad. ISS permanece sin serie instrumental aportada.

La [FDA explica las limitaciones de la oximetría](https://www.fda.gov/medical-devices/products-and-medical-procedures/pulse-oximeters) y recomienda no basar la evaluación únicamente en el dispositivo. Esa fuente respalda las precauciones de interpretación; **no valida los umbrales de este parche ni el sensor MAX30102 de este prototipo**.

## Verificación y despliegue

`npm test` incluye pruebas deterministas de estados del sensor, caducidad, fechas futuras, separación de intervalos, duplicados y ausencia de influencia radiológica. `tests/cloud.test.ts` añade comprobaciones del endpoint con PostgreSQL cuando `DATABASE_URL` está configurada, en un esquema temporal. Sin ella esa integración se omite; no se considera probada la conexión real a Supabase.

Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:bridge` y `npm run build`. La comprobación del navegador usa respuestas simuladas para no crear cuentas o lecturas reales. La prueba de integración con Supabase se completó el 15 de noviembre de 2026 usando el entorno privado del backend: 20 comprobaciones aprobadas, incluida la ruta DSS. Se creó y eliminó un esquema temporal, sin modificar los datos de app. La validación de la captura física y del despliegue web sigue siendo independiente.

## Colores y señal ECG

Cada indicador expone `alertLevel` (`review`, `priority` o null) para identificar qué regla produjo la revisión. El frontend resalta en rojo solo el indicador vigente y la instantánea que coincide en dispositivo, fecha e identificador con el DSS; las desviaciones respecto a la referencia personal también se destacan. Se conserva texto explicativo para no depender solo del color.

El dashboard añade un monitor de señal ECG cruda con la captura BLE web, anterior al muestreo de la API. Consultar [CAPTURA_BLE_WEB.md](CAPTURA_BLE_WEB.md) para frecuencia, escala y límites. No utiliza instantáneas de 1 Hz para simular un electrocardiograma ni modifica reglas médicas para obtener un color.

## Acciones trazables (reglas 2.2)

`state.actions` devuelve título, motivo, pasos, criterio de comprobación y, cuando corresponde, escalamiento. El panel muestra estas acciones en «Qué hacer ahora»; `state.recommendations` se conserva para clientes anteriores. Cada acción se deriva de los valores y estados actuales, no de la referencia histórica de radiación.

Para el ejemplo SpO₂ 80 %, pulso de oxímetro 300 lpm y ECG/respiración no disponibles, se ofrecen cuatro acciones: comprobar la saturación, contrastar el pulso, recuperar ECG y recuperar RPM. Una advertencia de calidad del pulso **no elimina la prioridad de la saturación baja**. No se presentan los ceros sin contacto como mediciones humanas.

El valor 300 lpm coincide con el techo de formato del pulso; también se pide comprobación ante un cambio de al menos 40 lpm entre las dos últimas muestras válidas separadas por hasta 10 segundos. Son reglas técnicas demostrativas de revisión, no límites fisiológicos ni pruebas de artefacto. No recortan ni corrigen valores. `checkRequired` indica necesidad de contraste; no invalida automáticamente una lectura aceptada por el firmware. La tendencia muestra el tiempo realmente transcurrido entre sus extremos y usa puntos porcentuales para SpO₂.

Los pasos de comprobación se apoyan en las [indicaciones de uso y limitaciones de la FDA](https://www.fda.gov/consumers/consumer-updates/pulse-oximeter-basics). La orientación de escalamiento se puede consultar en [MedlinePlus](https://medlineplus.gov/lab-tests/pulse-oximetry/). Estas fuentes no validan el montaje ni sus estimaciones. No se indican tratamientos, ajustes de oxígeno o cambios del traje. Al caducar los datos se retiran las acciones fisiológicas actuales y se solicita recuperar la captura.
