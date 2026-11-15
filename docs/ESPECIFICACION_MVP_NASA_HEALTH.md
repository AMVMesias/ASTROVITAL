# Especificación vigente de AstroVital

## Alcance

Aplicación web en línea: frontend y API Next.js en Vercel, persistencia PostgreSQL en Supabase. Esta decisión sustituye el diseño anterior de operación desconectada. Se requiere Internet para iniciar sesión, consultar y guardar datos.

## Roles y seguridad

Administrador: crear, consultar y editar cuentas, habilitar o inhabilitar usuarios, asignar rol y restablecer credenciales iniciales o desbloquear recuperación. No consulta salud personal. Debe permanecer al menos un administrador habilitado.

Astronauta: consultar y registrar únicamente sus mediciones, cambiar escenario ambiental, consultar evaluación, dispositivos y avisos propios, y registrar seguimiento o cierre de avisos. No administra cuentas.

Contraseñas con scrypt y sal; sesiones HttpOnly/SameSite con token aleatorio cuyo hash se guarda en PostgreSQL. Bloqueo de login por intentos fallidos. Cambios de contraseña, rol o habilitación revocan sesiones. Origen autorizado en mutaciones y secretos fuera de Git.

## Primer acceso y recuperación

El administrador entrega una contraseña inicial privada. El nuevo usuario cambia esa contraseña y configura exactamente tres preguntas distintas; al completar el proceso se revocan las sesiones y vuelve a iniciar sesión. Recuperación mediante desafío aleatorio de una pregunta configurada, hasta tres intentos persistentes y autorización temporal de un solo uso para cambiar la contraseña. El admin puede desbloquear la recuperación. No hay cuentas de ejemplo que autoricen cambios reales.

## Mediciones y entorno

Registro manual de sueño (0–24 h) y bienestar (entero 1–5). Pulso (1–300 bpm) mediante dispositivo autenticado. Conservar captura, recepción, autoría, origen, actividad y contexto ambiental histórico. Rechazar fechas futuras fuera de tolerancia y entradas inválidas. Repetir el mismo readingId del dispositivo conserva una sola lectura; otro contenido con ese ID se rechaza.

Catálogo documental con cuatro escenarios versionados. La selección tiene vigencia temporal. Las referencias ambientales se muestran con fuentes y no se convierten en biometría ni telemetría inventada.

Evaluación con reglas de demostración versionadas, referencia individual comparable, estado de datos insuficientes y antigüedad visible. Avisos de calidad y de variación diferenciados. Guardar acciones y transiciones de avisos con autor y fecha. Estas reglas no constituyen diagnóstico médico ni validación clínica.

## Criterios de aceptación

Desde el dominio público: login real, primer acceso, cuentas por rol, medición manual persistida en Supabase, historial propio, selector ambiental, evaluación y seguimiento. Rechazar acceso cruzado de usuarios y roles. El cierre de sesión y las revocaciones deben invalidar la cookie. Los despliegues automáticos parten de main; el esquema se versiona en supabase/migrations y se aplica mediante CLI.

## Sesiones y rendimiento

Cada cuenta admite una sola sesión activa. Otro navegador con las mismas credenciales recibe 409 SESSION_ACTIVE y conserva la sesión original. Reenviar el login desde el navegador que ya posee la cookie conserva esa sesión. Cerrar sesión, cambiar credenciales o vencer el plazo de ocho horas libera el acceso. Cerrar el navegador por sí solo no libera la sesión. JWT no es necesario para esta regla.

El login bloquea únicamente su fila de usuario durante la reserva de sesión. La comprobación de sesión y cuenta usa una consulta conjunta. El encabezado Server-Timing expone los tiempos de apertura de conexión y procesamiento, sin credenciales ni datos del usuario. Los tiempos de red, el arranque del servidor y la distancia a la región influyen en la carga.
