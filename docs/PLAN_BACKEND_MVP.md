# NASA Health · Plan de integración del backend

La [especificación del MVP](ESPECIFICACION_MVP_NASA_HEALTH.md) define el alcance y los permisos. La [guía de operación](BACKEND_PERSONA_1.md) describe los endpoints existentes y cómo probarlos.

| Responsable | Disponible | Entrega pendiente |
| --- | --- | --- |
| Persona 1 | Login, usuarios, dispositivos, captura HTTP, simulador, historial, SQLite y cola local. | Verificar la placa y el sensor, definir el contrato BLE e implementar el puente en el portátil. Integrar sesión y captura con el frontend. |
| Persona 2 | Carga versionada de los cuatro escenarios, asignaciones históricas, evaluación, avisos en SQLite y emisor/receptor de sincronización. | Registrar las migraciones de entorno y avisos en la conexión compartida, conectar el selector y la evaluación al flujo de captura, exponer sus resultados y configurar PostgreSQL para el despliegue. |
| Ambas | Contrato de medición compartido entre la cola y el receptor. | Probar captura física, cambios de entorno, recuperación de evaluación y sincronización de punta a punta. |

## Próximos hitos

1. **Captura BLE.** Confirmar placa, sensor, UUID de servicio y característica GATT, formato de notificación, frecuencia, reloj e ID estable de lectura. El puente del portátil traduce la notificación a `POST /api/v1/measurements` y conserva la credencial del dispositivo en el equipo local. Verificar una lectura física, su reenvío y la pérdida de señal con Internet desconectado.
2. **Entorno histórico.** Reemplazar el proveedor provisional por la asignación vigente a la hora de captura. Guardar escenario, perfil, versión, ámbito e ID de asignación con la medición. Probar una lectura tardía tras cambiar de perfil y un perfil sin telemetría. Provisionar las mismas versiones en PostgreSQL antes de sincronizar.
3. **Árbol de decisión.** Conectar la evaluación después de persistir una medición válida. Versionar los parámetros de demostración por indicador. Evaluar calidad y vigencia, disponibilidad de una referencia individual, y desviación sostenida. Mostrar motivo y evidencia junto con el contexto ambiental. Acordar cómo reprocesar una evaluación fallida sin duplicar avisos. El astronauta registra las acciones y cierra su propio aviso. Revisar el DSS aportado como insumo de diseño y rotular sus referencias según su alcance. [Evidencia y catálogo ambiental](INVESTIGACION_AMBIENTES_ESPACIALES.md)
4. **Integración y demo.** Con la LAN activa, iniciar sesión, capturar sueño y pulso, cambiar de perfil, reiniciar y comprobar el historial. Probar los estados estable, insuficiente, inválido, desactualizado y con desviación. Recuperar Internet, reenviar el mismo lote y comprobar una sola copia por medición en PostgreSQL y los estados de la cola en SQLite.

Ambas personas trabajan en `main`. La Persona 1 coordina los cambios de configuración y migraciones compartidas. La Persona 2 mantiene los módulos de entorno, evaluación, avisos y sincronización. Usar bases de prueba separadas.
