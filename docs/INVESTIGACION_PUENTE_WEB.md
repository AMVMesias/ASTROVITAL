# Viabilidad del puente ESP32 desde el navegador

Investigación del 14 de noviembre de 2026. Alcance: reemplazar el puente Python para que otra laptop use la URL de AstroVital sin instalar Python. No se realizó una prueba física del ESP32.

## Conclusión

Se pueden portar la recepción, el ensamblado, la validación, el muestreo y el envío del bridge a TypeScript en el navegador. No existe equivalencia total con un proceso de escritorio: cambian los permisos, la compatibilidad y las garantías de ejecución. Sin persistencia local tampoco se conserva la garantía de recuperar pendientes tras cerrar o reiniciar el navegador.

La primera implementación recomendada es USB/Web Serial a 115200 baudios y CSV de once columnas, porque coincide con los dos archivos de firmware versionados. BLE requiere confirmar otro firmware efectivamente cargado o incorporar un servidor GATT al firmware existente.

## Evidencia del repositorio

- `Pruebafinal/Pruebafinal.ino`: `Serial.begin(115200)`, once columnas en `enviarDatos()`, adquisición ECG objetivo de 250 muestras/s y salida serial nominal de 50 líneas/s. No contiene un servicio BLE ni envío Wi-Fi.
- `interfaz hmi/ASTROVITAL_HMI/monitor_ecg_resp_esp32/monitor_ecg_resp_esp32.ino`: mismo contrato serial relevante.
- `tools/bridge/bridge.py`: el modo USB abre 230400 baudios y exige diez columnas. Ese modo no coincide con el firmware versionado. El modo BLE `csv-11` sí decodifica los once campos completos. El firmware de la placa física podría ser otro: no se verificó.
- El bridge reconstruye líneas UTF-8 terminadas en LF con límite de 16384 bytes. Tiene modo explícito para eliminar parejas de fragmentos BLE duplicados. No calcula signos vitales: el firmware entrega los resultados.
- El bridge limita las instantáneas de captura a una por segundo como máximo y vacía la cola cada dos segundos. Leer muchas líneas no implica guardar toda la señal en la nube.
- `Spool` usa SQLite para conservar el payload, la fecha y el ID originales, los intentos, los rechazos y la confirmación. También conserva fecha original de JSON BLE repetido sin reloj de firmware.
- Se ejecutaron las 16 pruebas Python del bridge: todas pasaron. Son pruebas de software; no demuestran compatibilidad del firmware ni del navegador con la placa.
- Las rutas actuales de ingesta de dispositivos exigen `Authorization: Bearer` y `X-Device-Id`. Comprueban dispositivo, propietario habilitado, rol y primer acceso. La captura manual por cookie no permite registrar pulso.
- El dashboard carga sus datos al montar y al realizar acciones; no tiene un bucle periódico de actualización de telemetría ni un lector de hardware integrado.

## Correspondencia funcional

| Función Python | Implementación web propuesta | Equivalencia |
| --- | --- | --- |
| pyserial | Web Serial, selector de puerto y `open({baudRate:115200})` | Viable en navegador compatible y con puerto libre |
| Bleak/GATT | Web Bluetooth, selección y suscripción a característica | Viable si existe firmware BLE y soporte del sistema |
| Selección por MAC y consulta BlueZ/D-Bus | Selector del navegador, filtros por nombre/servicio | No es equivalente; la página no dispone del mismo acceso al sistema |
| Ensamblar fragmentos hasta LF | Buffer de bytes, TextDecoder estricto y límites | Portable con pruebas de paridad |
| CSV-11 / JSON v1 | Decodificadores TypeScript con los mismos contratos | Portable; no usar conversiones permisivas de campos vacíos |
| Estados, rangos y calidad | Validación cliente y comprobación autoritativa servidor | Portable |
| IDs y fechas estables | UUID de sesión de captura + secuencia, timestamp único por lectura | Portable durante captura/reintentos en memoria |
| Control de duplicados BLE | Modo explícito equivalente a NotificationCopies | Portable; no activarlo sin evidencia |
| Captura y HTTP concurrentes | Lector desacoplado del remitente, límites y backpressure | Portable |
| Cola SQLite persistente | Sin base local: cola pequeña en memoria o envío directo | No conserva datos al cerrar o recargar |
| Reconexión | Eventos de conexión/desconexión y reintento limitado | Condicionada por permisos, anuncio BLE y estado de página |
| Proceso continuo | Sesión de captura abierta en navegador | No garantiza continuidad al cerrar/suspender |
| Diagnóstico local | Panel con conteos de tramas, errores y estado de captura/envío | Portable sin registrar credenciales |

No debe copiarse un error antiguo para lograr paridad. En particular, la captura USB web debe interpretar las once columnas del firmware actual y enviar también la telemetría, no reproducir la expectativa de diez columnas del Python.

## Restricciones verificadas

Web Serial permite leer streams y está documentado para Chrome de escritorio en Windows, macOS, Linux y ChromeOS. Requiere permiso iniciado por el usuario. Fuente: https://developer.chrome.com/docs/capabilities/serial/

El soporte cambia con la versión. La tabla de MDN consultada indica Web Serial en Chrome/Edge, Firefox a partir de 151 y ausencia en Safari. Para Web Bluetooth indica Chrome/Edge con restricciones de plataforma, ausencia en Firefox/Safari y soporte Linux no habilitado por defecto. Detectar `navigator.serial`/`navigator.bluetooth` y validar una matriz real de equipos; no prometer cualquier navegador. Fuentes: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Serial.json y https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Bluetooth.json

Web Bluetooth necesita HTTPS, acción explícita para elegir dispositivo y servicios GATT autorizados. No sustituye las funciones de administración BlueZ de Python ni permite usar la MAC como identidad de aplicación. Fuente: https://developer.chrome.com/docs/capabilities/bluetooth y https://webbluetoothcg.github.io/web-bluetooth/

El navegador puede suspender o descartar páginas; al congelarse, los temporizadores y callbacks de fetch pueden detenerse. Mantener la pestaña abierta no equivale a garantizar ejecución continua. Una PWA no elimina por sí sola estas restricciones. Fuente: https://developer.chrome.com/docs/web-platform/page-lifecycle-api

USB puede requerir un controlador del conversor USB-UART o permisos del sistema, aunque no se instale Python. El puerto debe estar disponible: cerrar monitores seriales y otros programas que lo estén utilizando. Fuente del requisito de controlador: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/establish-serial-connection.html

## Diseño recomendado para AstroVital

Flujo: ESP32 → lector TypeScript del navegador → API Next.js por /api → PostgreSQL/Supabase. El backend desplegado no tiene acceso al hardware de la laptop. La conexión debe vivir en un componente cliente/proveedor de captura que no desaparezca al navegar entre páginas del panel.

1. El astronauta inicia sesión y elige un dispositivo provisionado y vinculado a su cuenta.
2. Pulsa Conectar ESP32, elige el puerto y autoriza el acceso.
3. El lector reconstruye y valida las líneas CSV-11. Muestra datos recientes y estado de conexión en la interfaz.
4. Se desacopla la visualización local de la persistencia: el límite inicial de envío debe conservar las instantáneas de aproximadamente 1 Hz del bridge. No enviar cada línea de 50 Hz como una petición HTTP.
5. Crear ingesta de navegador autorizada por la cookie HttpOnly del astronauta, validación de origen y comprobación del vínculo con el dispositivo. Compartir la lógica de validación con la ingesta de hardware; no confiar en un astronautId enviado por el cliente. Mantener el Bearer de dispositivo solo para equipos autónomos/Python cuando corresponda.
6. No incluir DATABASE_URL, claves de servicio o un DEVICE_TOKEN compartido en el bundle público. El permiso USB/BLE no demuestra por sí solo la identidad criptográfica de la placa; el CSV actual no autentica su procedencia.
7. Generar una sola fecha e ID por lectura y conservarlos en cada reintento. Limitar memoria y envíos concurrentes. Si se llena el límite o falla Internet, mostrar pérdida/no enviado explícitamente. No afirmar recuperación tras cerrar sin persistencia.
8. Actualizar el dashboard desde el estado de captura y refrescar datos confirmados del servidor con una frecuencia controlada. El volumen de tráfico y las escrituras se deben medir con el hardware.
9. Separar la sesión de usuario, la conexión al puerto y una sesión de captura; evitar dos lectores de la misma placa dentro de la aplicación. Revalidar autorización cuando venza o se revoque la sesión de usuario.

El firmware CSV actual no incluye una secuencia de adquisición ni timestamp UTC del dispositivo. Los identificadores y tiempos de recepción del navegador permiten deduplicar reintentos de HTTP, pero no demuestran que ninguna muestra se perdió entre el sensor y la laptop. Para esa garantía habría que ampliar el protocolo del firmware.

## Plan de validación antes de retirar el puente Python

- Portar los casos de las 16 pruebas Python a fixtures compartidas y comparar el resultado Python/TypeScript con fecha y configuración fijadas.
- Añadir CSV-11 USB a 115200, división arbitraria de fragmentos, múltiples líneas, campos vacíos, NaN/Infinity, UTF-8 inválido y paquetes superiores al límite.
- Probar en la placa real: selección, apertura, recepción, estados sin contacto, captura estable, desconexión/reconexión y cierre limpio. Confirmar MODO_DEBUG=0 y que el puerto no se use simultáneamente.
- Comprobar envío, confirmación, idempotencia de reintentos, rechazo de otro usuario, credencial vencida, desconexión de Internet y respuesta lenta del servidor.
- Probar cambiar de página, abrir otra pestaña, minimizar, suspender el equipo y cerrar/reabrir el navegador. Documentar pérdidas y límites observados.
- Confirmar exactamente los once campos guardados en Supabase y visibles en el dashboard. La visualización de onda a 50 líneas/s y su grabación completa son alcances distintos de las instantáneas que guardaba el bridge.

## Alternativa para monitorización independiente de la laptop

Si la prioridad fuera seguir capturando sin una página abierta, el ESP32 podría enviar HTTPS directamente al backend mediante Wi-Fi. Eso exige firmware de red, configuración Wi-Fi, credenciales de dispositivo, verificación TLS y reintentos controlados. No está implementado en los dos firmwares revisados. Espressif ofrece cliente HTTP/S: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_client.html

Una app de escritorio permitiría conservar un proceso local, pero exige instalación y no cumple la experiencia de usar solamente una URL. Para el alcance actual se recomienda USB en navegador compatible; BLE queda sujeto a confirmar el firmware GATT.
