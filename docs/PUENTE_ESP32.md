# Puente del portátil · ESP32 a API local

El sketch aportado usa USB Serial a 230400 baudios, MODO_DEBUG=0 y diez columnas:
`ecg,bpm,estado_ecg*50,resp_mg,rpm,estado_resp*50,ppg,spo2,bpm_ox,estado_ox*50`.
No implementa BLE ni comunica UUID, UTC, ID de arranque o secuencia. El puente no modifica el firmware ni calcula BPM, respiración o saturación. El backend continúa en Next.js/TypeScript; Python se usa únicamente como adaptador del sistema operativo para USB y Bluetooth.

## Instalar y configurar

Desde la raíz, con Node 22 y Python 3.10+:

```sh
python3 -m venv tools/bridge/.venv
tools/bridge/.venv/bin/python -m pip install -r tools/bridge/requirements.txt
npm run db:migrate
npm run db:seed
```

Los comandos leen `src/backend/.env.local` si existe; en instalaciones anteriores usan el `.env.local` de la raíz. Las variables exportadas en la terminal tienen prioridad. No se imprimen secretos. Configurar los valores siguientes en ese archivo:

```dotenv
DEVICE_USERNAME=astronauta1
DEVICE_ID=esp32-demo
# Definir una credencial privada de al menos 32 caracteres.
DEVICE_TOKEN=
BRIDGE_PYTHON=tools/bridge/.venv/bin/python
BRIDGE_API_URL=http://localhost:3001
BRIDGE_SPOOL_PATH=data/local/bridge.sqlite
BRIDGE_SAMPLE_SECONDS=1
BRIDGE_ACTIVITY=rest
SERIAL_PORT=/dev/ttyUSB0
```

Crear primero `astronauta1` por la API del admin y ejecutar `npm run device:provision`. No incluir la credencial en el firmware ni en el navegador: permanece en el portátil. El ID debe corresponder a la placa física autorizada. El puente rechaza enviar por HTTP a un host remoto; para otro equipo se requiere HTTPS. No sigue redirecciones HTTP con la credencial.

El ejemplo de puerto es ilustrativo: elegir el puerto de la placa (Linux `/dev/ttyUSB*` o `/dev/ttyACM*`; Windows `COM*`). No compartirlo con el monitor Serial del IDE. Confirmar que la placa realmente admite BLE antes de usar ese modo. No se han cambiado permisos del sistema ni emparejado dispositivos automáticamente.

## Sketch actual: USB Serial

En terminales separadas:

```sh
npm run dev:backend
npm run bridge:serial
```

El puente valida las diez columnas finitas. Como máximo una vez por segundo (configurable hacia una frecuencia menor), toma una instantánea de la columna BPM del AD8232:

| Estado ECG serial | Interpretación |
| --- | --- |
| `0` | `no_contact`; sin medición de pulso |
| `50` | `no_signal`; sin medición de pulso |
| `100` con BPM cero | `insufficient`; sin medición de pulso |
| `100` con BPM entre 1 y 300 | Instantánea de pulso; validación de formato, no clínica |

No envía los 250 valores de ECG por segundo, RPM, SpO₂ ni pulso del oxímetro. El formato no permite probar que cada fila corresponda a un latido nuevo, ni distinguir la retención transitoria durante debounce. Por eso el dato se identifica como `clock=host_received_csv_snapshot`: hora del portátil al recibir la muestra, no UTC de la placa ni validación de una nueva estimación. Confirmar reposo antes de usar `BRIDGE_ACTIVITY=rest`; usar `exercise` o `eva` cuando corresponda.

Cada ejecución del puente genera un ID de sesión propio y una secuencia de instantáneas; **no se presenta ese ID como ID de arranque del ESP32**. La fecha, ID y payload se persisten antes del envío. Reintentar o reiniciar el emisor conserva exactamente la lectura pendiente. Sin identificadores de firmware no se puede deduplicar una misma estimación entre dos sesiones físicas diferentes: son instantáneas distintas con recepción distinta.

## Contrato propuesto BLE v1

El modo `npm run bridge:ble` está implementado mediante Bleak, pero el sketch actual todavía no lo puede alimentar. Configurar los valores reales cuando firmware los entregue:

```dotenv
BLE_ADDRESS=
BLE_SERVICE_UUID=
BLE_CHARACTERISTIC_UUID=
```

La característica notifica JSON UTF-8 terminado en LF. Se reensamblan fragmentos; no se supone que una notificación contenga un mensaje completo. No hay UUID inventados o por defecto. Ejemplos de contrato:

```json
{"v":1,"deviceId":"esp32-demo","bootId":"arranque001","sequence":1,"quality":"valid","bpm":68,"capturedAt":"2026-11-14T12:00:00.000Z"}
{"v":1,"deviceId":"esp32-demo","bootId":"arranque001","sequence":2,"quality":"no_contact"}
```

`bootId` debe cambiar por arranque y `sequence` aumentar por evento, incluidos estados. El par forma `readingId`. El `deviceId` debe coincidir con el aprovisionado. No admitir `quality=valid` hasta tener contacto estable, al menos dos intervalos válidos, BPM positivo y detección reciente. Con las variables del sketch, firmware debe comprobar también `!sueltoAhora`, `!cambioPendiente`, `!sueltoEstable`, `cuenta>=2` y la antigüedad de `ultimoLatido`; el CSV actual no exporta todo ese contexto.

`capturedAt` es opcional solo para captura en vivo sin UTC de placa. En ese caso el puente registra recepción del portátil con `clock=host_received`, la conserva al repetir el mismo ID y no intenta reconstruir lecturas atrasadas. Para memoria de mediciones desconectadas en la placa, firmware debe aportar UTC verificable o acordar un protocolo de sincronización de reloj; no se fabrican fechas a partir de un contador sin ancla.

La pérdida de contacto/señal o desconexión llega a `POST /api/v1/devices/status` con la credencial del dispositivo. No produce BPM cero ni borra la última medición. Los estados nuevos no se sobrescriben con reenvíos de lecturas más antiguas. `GET /api/v1/me/device` entrega señal, fecha observada y última comunicación para el propio astronauta; `latest` incluye antigüedad del último dato.

## Cola del puente

Es independiente de la cola de sincronización con PostgreSQL. En el portátil guarda envíos pendientes hacia Next.js en `BRIDGE_SPOOL_PATH`, excluido de Git, sin token. Fallos de transporte, 429 y 5xx conservan pendientes; rechazos permanentes quedan con código y necesitan revisión. No se regeneran fechas ni IDs al recuperar conexión.

```sh
npm run bridge:status
npm run bridge:flush
# Solo después de corregir credencial o causa de rechazo:
npm run bridge:retry
```

Las confirmaciones se conservan para deduplicar notificaciones repetidas. No se purgan automáticamente datos. Un único puente debe consumir una misma placa y archivo de cola. Las escrituras de la API en SQLite generan además su pendiente hacia nube.

## Pruebas y límites verificados

```sh
npm run test:bridge
# Después de compilar el backend, en Linux:
BRIDGE_TEST_PYTHON=tools/bridge/.venv/bin/python npm run test:production
```

Las pruebas del puente no requieren hardware. La prueba adicional usa un pseudoterminal que reproduce CSV y pasa por pySerial, el proceso real del puente, HTTP y SQLite. La conexión física USB, Bluetooth y los UUID del ESP32 requieren la placa; una prueba emulada no acredita compatibilidad eléctrica, calidad del sensor ni validación clínica.

Fuentes de los adaptadores: [pySerial API](https://pyserial.readthedocs.io/en/latest/pyserial_api.html) y [BleakClient y notificaciones](https://bleak.readthedocs.io/en/latest/api/client.html). El paquete y la interpretación del CSV se basan en el sketch suministrado por el usuario.

## BLE conectado pero no descubierto

En Linux, el puente reutiliza el dispositivo que BlueZ ya tiene conectado antes de escanear: una placa conectada puede dejar de anunciarse. Para ASTROVITAL_BLE se verificaron dirección `68:09:47:48:6A:CA`, servicio `6e400001-b5a3-f393-e0a9-e50e24dcca9e` y característica TX con notificación `6e400003-b5a3-f393-e0a9-e50e24dcca9e`. Esto verifica GATT, no el formato del paquete ni recepción biométrica.

Si no está conectado, se busca por dirección durante diez segundos. El diagnóstico distingue dispositivo no descubierto, permisos D-Bus y errores de sistema. Revisar `bluetoothctl show` y `bluetoothctl info 68:09:47:48:6A:CA`; salir de bluetoothctl con `exit` antes de ejecutar `npm run bridge:ble` en la terminal normal. El firmware debe seguir cumpliendo el contrato JSON v1 terminado en LF descrito arriba.

## Firmware ASTROVITAL BLE actualizado (CSV de once columnas)

El sketch BLE confirmado usa servicio Nordic UART y notificaciones TX fragmentadas en bloques de hasta 20 bytes, con LF al final de cada línea. Su orden es `ecg,bpm_ecg,estado_ecg*50,resp_mg,rpm,estado_resp*50,spo2,bpm_oxi,estado_oxi*50,ir,rojo`. Configurar `BLE_FORMAT=csv-11`; el valor por defecto `json-v1` mantiene el contrato anterior. El puente concatena fragmentos y toma como máximo una instantánea por segundo del BPM ECG (segunda columna). Los estados ECG 0/50 y BPM cero producen estados, nunca pulso cero. Oximetría, respiración y señales crudas no se guardan como indicadores nuevos.

Este firmware no aporta UTC, bootId ni secuencia: se conservan fecha de recepción del portátil e identificador de sesión del puente, igual que en la captura CSV anterior. USB de este nuevo sketch usa 115200 y once columnas; el modo serial anterior sigue destinado al sketch original de diez columnas a 230400.

Para evitar `401`, definir `DEVICE_USERNAME` con el astronauta autorizado y ejecutar `npm run device:provision` usando el mismo `DEVICE_ID`, `DEVICE_TOKEN` y base local que el backend. Reiniciar el puente después de modificar `.env.local`. Los rechazos antiguos se conservan; `npm run bridge:retry` los reintenta explícitamente tras corregir la credencial.

## Inspección de la señal BLE antes del muestreo

Detener el puente con Ctrl+C antes de ejecutar `npm run bridge:inspect`: un solo consumidor debe usar la placa. La inspección observa durante 20 segundos y muestra conteos cada cinco segundos de todas las líneas completas, tramas inválidas, `valid_bpm`, `no_contact`, `no_signal` e `insufficient`, más bytes parciales. No abre la cola ni hace solicitudes HTTP. Se puede ajustar `BRIDGE_INSPECT_SECONDS` entre 1 y 60. Este modo requiere `BLE_FORMAT=csv-11`.

Un conteo `valid_bpm` mayor que cero confirma que al menos una línea recibida tiene estado ECG 100 y BPM entre 1 y 300; no certifica exactitud del sensor. Si solo aparece `no_contact`, el firmware indica electrodos sueltos. Si solo hay `no_signal` o `insufficient`, no entrega un BPM utilizable todavía. Si predominan líneas inválidas, investigar formato o pérdida de fragmentos. Si no llegan líneas, investigar notificaciones/conexión. Después de inspeccionar, reiniciar `npm run bridge:ble` y confirmar lecturas `origin=device` y `deviceId=esp32-demo` en el historial del astronauta vinculado. La oximetría no sustituye automáticamente al BPM ECG.

La inspección también muestra `last_sample`: fecha de recepción, CSV completo de once columnas, campos con nombre y estado ECG. Permite ver la transmisión aun sin sensores colocados. Los ceros permanecen como valores crudos de diagnóstico; no se envían ni se guardan como mediciones. Una línea inválida no reemplaza la última muestra válida; revisar su fecha y los conteos para distinguir datos antiguos. Si no ha llegado ninguna trama válida, `last_sample` es null.

## Fragmentos duplicados observados en ASTROVITAL

La captura real mostró cada fragmento dos veces consecutivas (inicio, inicio, final, final), produciendo líneas de 18 y 4 columnas. Para este enlace configurar `BLE_NOTIFICATION_COPIES=2`. El valor por defecto es 1; no se deduplican fragmentos automáticamente en enlaces normales. Con 2 se exige igualdad exacta de cada pareja, se consume una copia y se descarta la trama parcial si no coinciden. No sustituye un protocolo de firmware con secuencia/CRC: si el comportamiento del enlace cambia, volver a inspeccionar y configurar 1 cuando corresponda. Reiniciar el puente después del cambio. La inspección conserva una muestra breve de notificaciones crudas y cuenta `duplicate_fragments_removed`.

## API de los once campos ESP32

El puente BLE CSV-11 ahora persiste una instantánea de todos los campos como máximo una vez por segundo, incluso sin contacto: `POST /api/v1/devices/telemetry` con Bearer del dispositivo y X-Device-Id. Una cola independiente por evento conserva fecha, lectura e identidad en los reintentos. La tabla `sensor_telemetry` se incorpora mediante migración 006, sin borrar mediciones anteriores.

Como astronauta propietario, consultar `GET /api/v1/me/telemetry` (historial) o `GET /api/v1/me/telemetry/latest` (última instantánea). El historial permite `field` con cualquiera de los once nombres, `from`, `to`, `limit` y `offset`. En Swagger estos campos tienen un selector propio. También se incluye `telemetry` en `GET /api/v1/me/device` y `GET /api/v1/me/measurements/latest`. Admin y otros astronautas no acceden a los datos personales.

`fields` conserva los valores crudos, incluidos ceros, ECG, respiración, SpO2, pulso del oxímetro, IR y rojo. `sensors` contiene estados del firmware y estimaciones disponibles; cuando el estado o formato no permiten aceptar la estimación, el valor derivado es null. No se reemplaza automáticamente el BPM ECG por el del oxímetro. Esta telemetría no genera evaluación clínica ni se envía a PostgreSQL: la cola de sincronización de mediciones y sus tres indicadores sigue siendo independiente. `clock=host_received_csv_snapshot` identifica la fecha de recepción del portátil. El historial representa instantáneas a 1 Hz, no una señal ECG de 250 Hz.

Reiniciar el backend y el puente tras actualizar. Ejecutar `npm run db:migrate` desde la raíz si se desea aplicar explícitamente la nueva migración. Las instantáneas empiezan a guardarse desde que se ejecuta el puente actualizado; no se reconstruyen datos crudos antiguos.
