# Trabajo posterior al despliegue web

- Validar el hardware físico, el contacto de sensores, la calidad de señal y las tasas de captura.
- Revisar científicamente las reglas de demostración antes de interpretarlas como evidencia clínica.
- Ampliar reportes y visualizaciones según la revisión del equipo.
- Revisar usuarios, accesos, copias de seguridad y observabilidad para el uso previsto.

La aplicación vigente es en línea y persiste en Supabase. No se planifica operación desconectada en esta entrega.

## DSS de telemetría integrado

El panel de sensores/escenario y GET `/api/v1/me/dss` están implementados; ver [DSS_TELEMETRIA.md](DSS_TELEMETRIA.md). La integración con Supabase y la ruta DSS están verificadas en un esquema temporal (20 comprobaciones aprobadas). Pendiente validar el hardware y el entorno desplegado, revisar las reglas con especialistas y aportar los CSV originales RadLab para reproducir sus estadísticas. Los resúmenes suministrados se muestran como procedencia no reproducida, sin inferir efectos fisiológicos de la radiación.
