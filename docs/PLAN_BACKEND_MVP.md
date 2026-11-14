# NASA Health · Plan de integración del backend

La [especificación del MVP](ESPECIFICACION_MVP_NASA_HEALTH.md) define el alcance y los permisos. La [guía de operación](BACKEND_PERSONA_1.md) describe los endpoints existentes y cómo probarlos.

| Responsable | Disponible | Entrega pendiente |
| --- | --- | --- |
| Firmware | Sketch de AD8232, MPU6050 y MAX30102 con salida CSV por USB Serial. | Confirmar modelo del ESP32 y compatibilidad BLE. Añadir el servicio GATT y la característica de notificación. Para la primera entrega, publicar una estimación nueva de pulso del AD8232 cuando haya contacto estable, suficientes intervalos, BPM positivo y detección reciente. Publicar pérdida de contacto o señal como estado. Entregar un paquete válido y uno de pérdida de señal, con ID de arranque, secuencia y referencia de tiempo documentados. |
| Persona 1 | Login, usuarios, dispositivos, captura HTTP, simulador, historial, SQLite y cola local. | Implementar el puente BLE del portátil y vincular la placa aprovisionada. Decodificar notificaciones, reenviar el pulso a la API local con la credencial del dispositivo y conservar hora e ID en los reintentos. Integrar sesión y captura con el frontend. |
| Persona 2 | Carga versionada de los cuatro escenarios, asignaciones históricas, evaluación, avisos en SQLite y emisor/receptor de sincronización. | Registrar las migraciones de entorno y avisos en la conexión compartida. Conectar selector y evaluación a captura. Versionar reglas demostrativas y exponer calidad, vigencia, referencia, evidencia y avisos al tablero. Probar con lecturas simuladas mientras firmware y Persona 1 integran BLE. Configurar PostgreSQL para el despliegue. |
| Firmware y software | API de ingesta y contrato entre la cola local y el receptor PostgreSQL. | Acordar el contrato BLE y ejecutar la prueba física. Las dos personas de backend verifican también el cambio de entorno, el reprocesamiento de la evaluación y la sincronización de punta a punta. |

## Contrato BLE por cerrar

Firmware y Persona 1 acuerdan los UUID del servicio y de la característica GATT, la versión y el formato del paquete, sus unidades, estados de calidad, cadencia de envío y ejemplos de notificación. El emisor distingue cada lectura mediante ID de arranque y secuencia. Firmware aclara si la placa dispone de UTC o de un reloj relativo. El puente conserva el ID y la fecha al reenviar el mismo registro. La Persona 2 verifica que la hora de captura permita seleccionar la asignación ambiental histórica. Si solo se dispone de la hora del portátil, se identifica como hora de recepción en la prueba en vivo y se deja pendiente la validación de lecturas atrasadas.

## Próximos hitos

1. **Captura BLE.** Firmware prueba la notificación con pulso válido y el estado de pérdida de señal. Persona 1 reenvía a `POST /api/v1/measurements` y conserva la credencial en el portátil. Con Internet desconectado, verificar que el historial recibe la lectura, que el reenvío deja una sola fila en SQLite y que al cortar la señal se conserva el último valor con su antigüedad.
2. **Entorno histórico.** Reemplazar el proveedor provisional por la asignación vigente a la hora de captura. Guardar escenario, perfil, versión, ámbito e ID de asignación con la medición. Probar una lectura tardía tras cambiar de perfil y un perfil sin telemetría. Provisionar las mismas versiones en PostgreSQL antes de sincronizar.
3. **Árbol de decisión.** Conectar la evaluación después de persistir una medición válida. Versionar los parámetros de demostración por indicador. Evaluar calidad y vigencia, disponibilidad de una referencia individual, y desviación sostenida. Mostrar motivo y evidencia junto con el contexto ambiental. Acordar cómo reprocesar una evaluación fallida sin duplicar avisos. El astronauta registra las acciones y cierra su propio aviso. Revisar el DSS aportado como insumo de diseño y rotular sus referencias según su alcance. [Evidencia y catálogo ambiental](INVESTIGACION_AMBIENTES_ESPACIALES.md)
4. **Integración y demo.** Con la LAN activa, iniciar sesión, capturar sueño y pulso, cambiar de perfil, reiniciar y comprobar el historial. Probar los estados estable, insuficiente, inválido, desactualizado y con desviación. Recuperar Internet, reenviar el mismo lote y comprobar una sola copia por medición en PostgreSQL y los estados de la cola en SQLite.

Ambas personas trabajan en `main`. La Persona 1 coordina los cambios de configuración y migraciones compartidas. La Persona 2 mantiene los módulos de entorno, evaluación, avisos y sincronización. Usar bases de prueba separadas.
