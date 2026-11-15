# Captura BLE desde AstroVital

La recepción ocurre en el navegador de la laptop, con la URL HTTPS de AstroVital. No necesita ejecutar Python ni un backend local. El ESP32 debe estar emitiendo notificaciones GATT en el formato CSV-11 que utiliza el bridge actual. No se requiere conectar la laptop al Wi-Fi del ESP32.

## Uso

1. El administrador crea la cuenta de astronauta y, en Usuarios, pulsa Vincular ESP32. Asigna un ID interno único, por ejemplo esp32-01. No es una dirección MAC. Una placa ya vinculada a otro astronauta no se reasigna con esta operación. No se rotan las credenciales del bridge Python existente.
2. El astronauta completa el primer acceso e inicia sesión en una laptop y navegador compatibles con Web Bluetooth, por ejemplo Chrome/Edge en Windows con Bluetooth habilitado.
3. En el dashboard selecciona su dispositivo y la actividad. En Configuración BLE comprueba los UUID del servicio y la característica y el número de copias de cada fragmento. Los valores iniciales corresponden al ejemplo documentado del Python; no prueban el firmware cargado en una placa concreta.
4. Pulsa Conectar ESP32 y autoriza la placa en el selector del navegador. La aplicación solicita acceso al servicio GATT configurado, se suscribe a la característica y reconstruye las líneas terminadas en LF.
5. La tarjeta muestra los once campos crudos, el estado de captura y los envíos confirmados. El resumen y los avisos se refrescan de forma limitada después de las confirmaciones. Usa Desconectar al terminar.

La conexión se conserva al navegar entre páginas del panel del astronauta; se libera al salir del panel o cerrar la sesión. Otra pestaña de AstroVital no debe capturar simultáneamente: se usa Web Locks cuando el navegador lo ofrece. El permiso de Bluetooth es independiente de la sesión de usuario.

## Protocolo y límites

CSV-11: ecg,bpm_ecg,estado_ecg_x50,resp_mg,rpm,estado_resp_x50,spo2,bpm_oxi,estado_oxi_x50,ir,rojo. Rechazar columnas vacías, valores no finitos, estados desconocidos y fragmentos/paquetes incompatibles. Buffer máximo: 16384 bytes. El modo de dos copias exige que cada pareja de notificaciones sea idéntica; activarlo únicamente si el firmware/enlace realmente duplica los fragmentos.

Se captura y envía como máximo una instantánea por segundo. Un ECG sin contacto, sin señal o con BPM aún insuficiente no se convierte en pulso válido; la telemetría cruda y el estado sí se conservan. Los filtros y cálculos biométricos siguen siendo responsabilidad del firmware. No se graba la onda completa de 250 Hz ni se promete precisión clínica.

Cada lectura obtiene un ID y una fecha de recepción únicos, conservados en sus reintentos. El frontend mantiene un máximo de diez pendientes en memoria, un solo envío simultáneo y hasta tres intentos por pendiente, con espera limitada. No se introduce SQLite, IndexedDB ni almacenamiento persistente. Al cerrar la captura, recargar o cerrar la página se pierden los pendientes no confirmados; una respuesta perdida tampoco demuestra que el servidor no haya guardado el dato. Los contadores indican confirmaciones, no entrega exactamente una vez.

No se garantiza captura al cerrar/minimizar/suspender el navegador o el equipo. Ante desconexión, el usuario debe revisar la placa y volver a conectar. El estado disconnected se comunica al servidor en mejor esfuerzo. La laptop necesita Internet para autenticar y confirmar los envíos a Supabase.

## API y seguridad

POST /api/v1/me/device/capture usa la cookie HttpOnly del astronauta, valida origen, rol, primer acceso y vínculo con un dispositivo habilitado. Recibe deviceId y uno o más componentes telemetry, measurement o signal; measurement y signal son mutuamente excluyentes. Guarda la telemetría y el pulso/estado dentro de una transacción, conserva la deduplicación y procesa la evaluación.

POST /api/v1/users/{id}/devices permite al administrador vincular un dispositivo a un astronauta habilitado. No devuelve secretos ni cambia el propietario de un dispositivo existente. Los endpoints Bearer del Python/firmware continúan disponibles para esos clientes.

No se incrustan credenciales de PostgreSQL ni tokens de dispositivo compartidos en el navegador. El backend determina el propietario desde la sesión y la base de datos. El permiso del navegador y un CSV válido no prueban criptográficamente la identidad física de la placa: el firmware actual no firma las tramas.

## Verificación

tests/ble.test.ts prueba fragmentación, varias líneas, duplicados explícitos, desbordamiento, UTF-8 inválido, once campos, pulso válido y estados sin contacto. tests/cloud.test.ts verifica la ingesta autenticada, rechazo de otro propietario, vinculación administrativa, conservación de credenciales anteriores, rollback y deduplicación contra PostgreSQL en un esquema temporal.

Las pruebas automatizadas no sustituyen la prueba física. Antes de usarlo en una demo, confirmar con el ESP32 real los UUID, CSV-11 y duplicados; comprobar la primera lectura, los once valores en Supabase, diez minutos de captura, desconexión/reconexión, cambio de página, expiración de sesión y pérdida de Internet. No se ha realizado esa prueba física desde este entorno.
