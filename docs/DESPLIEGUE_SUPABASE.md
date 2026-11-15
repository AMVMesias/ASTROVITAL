# Despliegue de AstroVital

## Arquitectura vigente

Navegador → frontend Next.js → proxy /api → backend Next.js → PostgreSQL de Supabase. El sistema requiere Internet. La API valida la sesión y el rol en cada operación. Las credenciales de PostgreSQL nunca se envían al navegador. No se utiliza Supabase Auth: la autenticación existente guarda hashes scrypt y sesiones con tokens hasheados en PostgreSQL.

Frontend Vercel: astrovital, raíz src/frontend, dominio astrovital-health.vercel.app. Backend: astrovital-backend, raíz src/backend, dominio astrovital-backend.vercel.app. Ambos están conectados a AMVMesias/ASTROVITAL, rama main. Node 22.x. El backend instala desde la raíz con cd ../.. && npm ci --include=dev.

Supabase: proyecto astrovital, referencia ccwwalalqyqcwajrgxbr, región us-east-1. El esquema app contiene las tablas de la aplicación, con RLS y sin permisos para anon/authenticated. Solo el servidor accede por PostgreSQL. La conexión usa el transaction pooler y verifica la CA y el nombre del servidor.

## Variables

Backend: DATABASE_URL, DATABASE_CA (PEM), APP_ORIGIN=https://astrovital-health.vercel.app y COOKIE_SECURE=true. Frontend: BACKEND_URL=https://astrovital-backend.vercel.app. Nunca poner secretos en NEXT_PUBLIC_.

Para desarrollo usar src/backend/.env.local con APP_ORIGIN=http://localhost:3000 y COOKIE_SECURE=false. Los archivos .env están excluidos de Git. Las credenciales iniciales del administrador se guardan en .env.admin.local del equipo que aprovisionó el proyecto; no compartirlas en Git ni mensajes públicos. El administrador debe completar el primer acceso y cambiar su contraseña.

## Migraciones

supabase login
supabase link --project-ref ccwwalalqyqcwajrgxbr
supabase db push --remote --dry-run
supabase db push --remote

Coordinar una sola persona para aplicar migraciones. No modificar migraciones ya aplicadas ni usar db reset --remote. El historial inicial de sincronización queda solo como historial de migraciones; las tablas retiradas se eliminan con una migración posterior.

## Aprovisionamiento y comprobación

Configurar ADMIN_USERNAME y ADMIN_PASSWORD privados y ejecutar npm run db:seed; el comando conserva las cuentas existentes. El catálogo se carga desde el JSON documental validado. Para un dispositivo, configurar DEVICE_USERNAME, DEVICE_ID y DEVICE_TOKEN y ejecutar npm run device:provision. El dispositivo envía directamente a la API HTTPS.

npm run lint
npm run typecheck
npm run build
npm test

Las pruebas de PostgreSQL usan un esquema temporal separado de app. Para comprobar la API publicada: definir API_URL=https://astrovital-health.vercel.app, SMOKE_USERNAME y SMOKE_PASSWORD y ejecutar npm run test:production. No hay envío de pendientes ni servicio de sincronización.

## Sesiones y rendimiento

Cada cuenta admite una sola sesión activa. Otro navegador con las mismas credenciales recibe 409 SESSION_ACTIVE y conserva la sesión original. Reenviar el login desde el navegador que ya posee la cookie conserva esa sesión. Cerrar sesión, cambiar credenciales o vencer el plazo de ocho horas libera el acceso. Cerrar el navegador por sí solo no libera la sesión. JWT no es necesario para esta regla.

El login bloquea únicamente su fila de usuario durante la reserva de sesión. La comprobación de sesión y cuenta usa una consulta conjunta. El encabezado Server-Timing expone los tiempos de apertura de conexión y procesamiento, sin credenciales ni datos del usuario. Los tiempos de red, el arranque del servidor y la distancia a la región influyen en la carga.
