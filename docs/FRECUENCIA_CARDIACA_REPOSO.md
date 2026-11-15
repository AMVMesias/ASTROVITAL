# Frecuencia cardíaca en reposo: implementación y prueba

## Auditoría del checkout

- `src/backend/src/backend/application/measurements/MeasurementService.ts` asignaba `rest` si faltaba `activity`. La recepción autenticada, deduplicación y filtros personales ya existían.
- `src/backend/src/backend/application/assessment/assessMeasurements.ts` aislaba persona, misión, indicador, unidad, ambiente, simulación y actividad; podía evaluar pulso de ejercicio o actividad ausente como si tuviese una referencia comparable.
- `src/frontend/src/frontend/features/dashboard/MissionDashboard.tsx` mezclaba resumen, registro manual, selección de ambiente y seguimiento. No mostraba contexto ni referencia cardíaca específicamente en reposo.
- El receptor vigente es `POST /api/v1/measurements`, con Bearer del dispositivo y `X-Device-Id`. También existen rutas de estado de señal y telemetría cruda. No están el firmware ESP32 ni `tools/bridge` en este checkout. El script npm `test:bridge` apunta a una carpeta ausente; no equivale a una integración hardware comprobada.
- Los registros PostgreSQL guardan un payload JSON: no hace falta alterar el esquema ni reescribir históricos para añadir contexto desconocido y trazabilidad de confirmación.

## Contrato de captura

Actividades permitidas: `rest`, `exercise`, `eva`, `unknown`. Omitir `activity` produce `unknown`; `null` y otros valores se rechazan. El valor de pulso nunca determina la actividad.

Para confirmar contexto se usa el campo existente `activity` en la captura autenticada. El operador/productor debe declarar `rest` únicamente cuando haya confirmado que la persona está en reposo; si el firmware/puente no conoce el contexto, debe omitirlo o enviar `unknown`. No se deduce reposo de ECG, pulso normal o telemetría cruda.

El servidor genera `activityConfirmed` (no se acepta como entrada del cliente) y conserva el contexto junto con dispositivo/autorización, `readingId`, fecha, origen, calidad y autoría existentes. Es confirmación declarada por el productor autenticado, no detección fisiológica certificada ni verificación independiente del estado de la persona.

Ejemplo de cuerpo de la API, con un **valor ilustrativo que debe sustituirse por la lectura real**:

```json
{
  "readingId": "identificador-unico-de-la-lectura-real",
  "indicator": "heart_rate",
  "value": 72,
  "unit": "bpm",
  "capturedAt": "2026-11-14T12:00:00.000Z",
  "activity": "rest"
}
```

La fecha también debe ser la fecha real UTC de captura. Reintentar conserva el mismo contenido e identificador; cambiar el contexto de un ID ya capturado produce conflicto. No hay reclasificación retrospectiva. Un reenvío antiguo sin actividad puede recuperar su payload original mediante la huella del formato anterior, sin sobrescribirlo.

## Históricos y referencia

Los payloads antiguos permanecen intactos. Antes de esta corrección, `activity: rest` podía proceder tanto de una declaración explícita como del valor por defecto: no es posible distinguirlos retrospectivamente. Por prudencia, el adaptador de evaluación interpreta como no confirmado el contexto cardíaco sin `activityConfirmed: true`; la interfaz hace lo mismo. Esto puede exigir recolectar una referencia nueva y evita certificar como reposo una suposición histórica.

La regla cardíaca se versiona como `demo-heart-rate-rest-2`. Conserva los parámetros configurados del prototipo (sin nuevos umbrales clínicos). Solo las muestras válidas en reposo confirmado de la misma persona/misión, indicador/unidad, ambiente/revisión y clase real/simulada dentro de la ventana participan en la referencia.

La referencia puede estar disponible al alcanzar el mínimo de muestras, mientras la evaluación sigue `insufficient` si faltan muestras separadas para verificar persistencia. La evaluación sostenida conserva una referencia separada de las muestras recientes. Ejercicio/EVA/no confirmado pueden mostrar una referencia previa en reposo, pero su lectura actual nunca se evalúa como reposo ni genera desviación de reposo. Lecturas actuales inválidas o caducadas conservan esos estados. Sueño/bienestar mantienen su motor de evaluación.

## Dashboard y navegación

`/dashboard` es un resumen sin formularios. Usa solo datos de la API; convierte la unidad de visualización cardíaca `bpm` a `lpm`, conservando el contrato de almacenamiento. Muestra fecha, contexto, calidad, origen, referencia y evaluación. La vigencia utiliza `maxAgeSeconds` enviado por la API desde las reglas configuradas. Se actualiza cada 15 segundos y manualmente. Una lectura vigente no certifica conexión continua; se muestra la última comunicación y se aclara que la conexión en tiempo real no está verificada.

Registro de sueño/bienestar (`/registros`), selección de entorno (`/entorno`) y acciones de avisos (`/avisos`) se conservan mediante las vistas de `MeasurementWorkspace`. El historial enlaza al registro. La actividad del registro se elige explícitamente, empezando en no confirmada. El pulso sigue sin admitirse como registro manual.

## Probar

1. Ejecutar frontend/backend con la configuración habitual del proyecto y acceder con una cuenta astronauta que haya completado el primer acceso.
2. Elegir un entorno en **Registros y seguimiento** si todavía no hay uno vigente para la captura.
3. Enviar lecturas reales al receptor con el dispositivo aprovisionado. Omitir actividad: el dashboard muestra **No confirmado** y nunca lo llama reposo.
4. Enviar nuevas lecturas con `activity: rest` solo con contexto confirmado; hacen falta cinco muestras históricas válidas para mostrar referencia con la regla actual, y muestras recientes separadas para evaluar persistencia. No alterar IDs ni fechas para fabricar historia.
5. Enviar una nueva lectura `exercise` o `eva`: aparece como lectura actual con ese contexto; la referencia previa en reposo se mantiene separada y la evaluación de reposo no se presenta como estable/desviada.
6. Esperar más del máximo de vigencia configurado para comprobar **Lectura desactualizada**. Si no existe referencia válida, aparece **Referencia insuficiente**.
7. Confirmar que otro astronauta ve solo sus mediciones y que admin continúa restringido al panel de cuentas.

Pruebas automatizadas: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. La suite PostgreSQL requiere `DATABASE_URL` y se omite si no está configurada. Las pruebas en memoria no reemplazan una validación con ESP32 real; no se dispone de firmware/puente para comprobar cómo recoge la declaración del operador.

## Diseño y datos de sensores

El resumen sigue la referencia visual aportada: navegación lateral, signos vitales, evaluación, tendencia de 24 horas, avisos y tarjetas de sueño/bienestar/dispositivo. Adapta sus columnas a móvil y ofrece modo oscuro. La gráfica usa hasta 200 mediciones cardíacas y 200 instantáneas de telemetría de las últimas 24 horas; no es una serie exhaustiva de alta frecuencia. No mezcla pulso simulado con pulso físico en una misma serie y etiqueta la simulación.

SpO₂ y respiración usan únicamente los campos `sensors` devueltos por la API de telemetría, que entrega `null` cuando el estado/formato del sensor no permite la lectura. Se presentan como telemetría sin evaluación: no se les asignan rangos clínicos ni estados normales inventados. La fecha de la instantánea queda visible. La etiqueta de evaluación estable se limita al pulso en reposo evaluado, no certifica el estado global de salud.

## Archivos de esta entrega

- `docs/FRECUENCIA_CARDIACA_REPOSO.md`
- `src/backend/src/backend/application/assessment/AssessmentService.ts`
- `src/backend/src/backend/application/assessment/assessMeasurements.ts`
- `src/backend/src/backend/application/assessment/recommendations.ts`
- `src/backend/src/backend/application/measurements/MeasurementService.ts`
- `src/backend/src/backend/domain/model.ts`
- `src/backend/src/backend/transport/openapi.ts`
- `src/frontend/src/app/(panel)/avisos/page.tsx`
- `src/frontend/src/app/(panel)/entorno/page.tsx`
- `src/frontend/src/app/(panel)/registros/page.tsx`
- `src/frontend/src/app/(panel)/reportes/page.tsx`
- `src/frontend/src/frontend/components/layout/AdminShell.tsx`
- `src/frontend/src/frontend/components/layout/SessionPanel.tsx`
- `src/frontend/src/frontend/components/layout/admin.css`
- `src/frontend/src/frontend/components/ui/AdminIcon.tsx`
- `src/frontend/src/frontend/features/dashboard/MeasurementWorkspace.tsx`
- `src/frontend/src/frontend/features/dashboard/MissionDashboard.tsx`
- `src/frontend/src/frontend/features/dashboard/VitalTrend.tsx`
- `src/frontend/src/frontend/features/dashboard/dashboard.module.css`
- `src/frontend/src/frontend/features/dashboard/readingPresentation.ts`
- `tests/assessment.test.ts`
- `tests/resting-heart-rate.test.ts`
## Validación de esta entrega

- `npm run lint`: correcto, sin errores ni advertencias.
- `npm run typecheck`: correcto en frontend, backend y pruebas/scripts.
- `npm test`: 11 pruebas aprobadas; 1 suite de integración Supabase omitida por falta de `DATABASE_URL`.
- `npm run build`: compilaciones de backend y frontend correctas.
- Navegador con API simulada: revisión visual a 1671, 390 y 320 píxeles; modo oscuro; reposo/ejercicio/contexto histórico no confirmado; ausencia de datos y de gráfica ficticia; dashboard sin formularios; registro manual accesible desde menú de escritorio y móvil; navegación a avisos.
- Regresión de admin con API simulada: búsqueda/filtros, edición, desbloqueo, menú móvil y navegación a creación, sin errores de página ni desbordamiento a 390 píxeles.
- Las capturas comparativas emplean exclusivamente fixtures de prueba interceptados en el navegador; no se insertaron como salud real ni se modificó una base de producción.
- La validación original se realizó en `codex/frecuencia-cardiaca-reposo`.

## Integración con main

La integración conserva la captura Web Bluetooth, su proveedor durante la navegación y las mejoras de sesión única y rendimiento de main. El dashboard incorpora Conectar/Desconectar y se actualiza después de recibir capturas confirmadas. La actividad de Bluetooth empieza en `unknown`; reposo requiere selección explícita.

Se actualizó el doble de prueba de sesiones al contrato `sessionAccount`. La integración PostgreSQL comprueba la captura autenticada, la persistencia de contexto desconocido y reposo confirmado, el historial y la telemetría filtrados por fecha. Se corrigió la tipificación de parámetros opcionales de estos filtros mediante `CAST(... AS TEXT)`.

Ejecutar la suite con credenciales locales, sin imprimir secretos:

```sh
node --env-file=.env.cloud.local --import tsx --test tests/*.test.ts
```

La suite crea un esquema temporal separado de `app` y lo elimina al terminar. No sustituye una prueba física con el ESP32.
