# Puente ESP32 y backend Supabase

El puente sigue ejecutándose en el portátil con acceso Bluetooth. El flujo es ESP32 → BLE → Python/Bleak → API Next.js → PostgreSQL/Supabase. El SQLite del puente es solo una cola local de reintentos; no reemplaza la base Supabase del backend.

## Instalación

Desde la raíz, con Node 22 y Python 3.10+:

```sh
python3 -m venv tools/bridge/.venv
tools/bridge/.venv/bin/python -m pip install -r tools/bridge/requirements.txt
```

Los comandos cargan `src/backend/.env.local` si existe; en caso contrario, `.env.local` de la raíz. Las variables exportadas tienen prioridad. Configurar en el archivo efectivo:

```dotenv
BRIDGE_API_URL=http://localhost:3001
DEVICE_USERNAME=astronauta1
DEVICE_ID=esp32-demo
DEVICE_TOKEN=
BLE_ADDRESS=68:09:47:48:6A:CA
BLE_SERVICE_UUID=6e400001-b5a3-f393-e0a9-e50e24dcca9e
BLE_CHARACTERISTIC_UUID=6e400003-b5a3-f393-e0a9-e50e24dcca9e
BLE_FORMAT=csv-11
BLE_NOTIFICATION_COPIES=1
```

Definir DEVICE_TOKEN privado de al menos 32 caracteres. Aprovisionar la placa contra la base Supabase actual mediante `npm run device:provision`; las credenciales antiguas de SQLite no migran automáticamente. El backend requiere DATABASE_URL, DATABASE_CA y sus migraciones Supabase. El usuario vinculado debe existir, estar habilitado y haber completado el primer acceso. No imprimir ni publicar tokens.

## Ejecutar

En terminales separadas:

```sh
npm run dev:backend
npm run bridge:ble
```

El puente envía once campos a POST /api/v1/devices/telemetry, estados a POST /api/v1/devices/status y BPM ECG válido a POST /api/v1/measurements. Como astronauta propietario, consultar GET /api/v1/me/telemetry/latest o GET /api/v1/me/telemetry en Swagger. El selector field permite elegir cualquiera de los once campos. No es necesario cambiar el firmware ni integrar el frontend para recibirlos.

Para inspeccionar sin guardar, detener antes el puente y ejecutar `npm run bridge:inspect`. Para consultar la cola sin conectar Bluetooth: `npm run bridge:status`. Los comandos `bridge:flush` y `bridge:retry` envían pendientes o reintentan rechazos respectivamente: utilizarlos después de corregir las causas del error.

El contrato CSV-11 es ecg,bpm_ecg,estado_ecg×50,resp_mg,rpm,estado_resp×50,spo2,bpm_oxi,estado_oxi×50,ir,rojo. El puente guarda instantáneas de máximo 1 Hz, con fecha del portátil e identificador estable durante reintentos; no almacena la señal completa de 250 Hz. Sin contacto no se convierte BPM cero en una medición válida. Los datos crudos permanecen disponibles en telemetría.

BLE_NOTIFICATION_COPIES=1 corresponde al enlace normal. Usar 2 solo si la inspección demuestra que cada fragmento llega dos veces; un modo incorrecto invalida las tramas. La API remota debe usar HTTPS; HTTP solo se permite hacia localhost. Las credenciales permanecen en el portátil; no se sigue una redirección HTTP con ellas.

## Validación

```sh
npm run test:bridge
npm run typecheck
```
