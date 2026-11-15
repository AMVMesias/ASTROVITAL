# AstroVital

Aplicación de seguimiento de salud con frontend y backend Next.js y PostgreSQL en Supabase. Requiere Internet. Usuarios, sesiones, recuperación, mediciones, perfiles ambientales y avisos se guardan en Supabase.

## Desarrollo

Usar Node 22.13+ de la rama 22 y ejecutar npm ci. Copiar src/backend/.env.example a src/backend/.env.local y src/frontend/.env.example a src/frontend/.env.local. Configurar DATABASE_URL y DATABASE_CA únicamente en el backend. En terminales separadas: npm run dev:backend y npm run dev:frontend. El frontend usa /api mediante un proxy al backend.

## Producción

Frontend: https://astrovital-health.vercel.app. Backend: https://astrovital-backend.vercel.app/api. Ambos proyectos Vercel están conectados a AMVMesias/ASTROVITAL, rama main. El backend usa src/backend y el frontend src/frontend. Cada push despliega el código; las migraciones de base requieren supabase db push --remote.

Consultar docs/DESPLIEGUE_SUPABASE.md para variables, migraciones y primer administrador. npm run db:seed aprovisiona el catálogo y el admin desde variables privadas; no reemplaza cuentas existentes. La cuenta inicial recibe credenciales privadas y debe completar el primer acceso.

## Verificación

npm run lint, npm run typecheck y npm run build. npm test ejecuta la integración con PostgreSQL cuando DATABASE_URL está definida; crea un esquema temporal y lo elimina al terminar. npm run test:production verifica HTTPS con API_URL, SMOKE_USERNAME y SMOKE_PASSWORD.
