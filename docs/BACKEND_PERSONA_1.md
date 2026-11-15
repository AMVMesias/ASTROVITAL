# Backend de AstroVital

La implementación vigente usa PostgreSQL en Supabase y operaciones asíncronas con pg. Las rutas conservan validación, permisos y contratos de autenticación, cuentas, mediciones, telemetría, entorno y avisos. El contexto por petición libera la conexión al terminar. Las transacciones conservan las escrituras relacionadas y las restricciones administrativas.

Consultar DESPLIEGUE_SUPABASE.md para configuración, aprovisionamiento y despliegue, y ESPECIFICACION_MVP_NASA_HEALTH.md para requisitos. Swagger está en /api/docs y OpenAPI en /api/openapi, ambos accesibles a través del frontend. La cookie de sesión se establece al ejecutar login. El sistema necesita Internet.
