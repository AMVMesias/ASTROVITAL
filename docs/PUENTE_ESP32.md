# Dispositivos y API HTTPS

El backend público recibe pulso en POST /api/v1/measurements y telemetría de once campos en POST /api/v1/devices/telemetry. Usar Content-Type: application/json, X-Device-Id y Authorization: Bearer con la credencial provisionada del dispositivo. El servidor comprueba la cuenta vinculada, el rol, el primer acceso, los campos, las fechas y los IDs de lectura.

Provisionar el vínculo mediante npm run device:provision con DEVICE_USERNAME, DEVICE_ID y DEVICE_TOKEN privados. El transporte del firmware o del equipo que recibe BLE/USB debe enviar por HTTPS al backend. La aplicación web no almacena una cola en el equipo. Las pruebas físicas y el protocolo final del firmware siguen requiriendo verificación conjunta.
