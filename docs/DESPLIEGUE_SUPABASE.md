# Receptor de sincronización en la nube

El equipo local conserva Next.js y SQLite. El receptor Next.js se publica en el proyecto Vercel `astrovital-backend` desde `src/backend`, conectado a `AMVMesias/ASTROVITAL`, rama `main`. El frontend conserva su proyecto independiente `astrovital`.

Supabase: proyecto `astrovital`, referencia `ccwwalalqyqcwajrgxbr`, región `us-east-1`. El esquema y el catálogo inicial están versionados en `supabase/migrations`. Las tablas tienen RLS activado y no permiten acceso a los roles `anon` y `authenticated`; el receptor usa una conexión PostgreSQL privada.

## Migraciones

Desde la raíz, con Supabase CLI autenticada:

```powershell
supabase link --project-ref ccwwalalqyqcwajrgxbr
supabase db push --remote --dry-run
supabase db push --remote
```

La CLI 3 usa la base local por defecto: indicar `--remote` para aplicar al proyecto enlazado. No usar `db reset --remote`. Coordinar un único responsable de aplicar migraciones y registrar cada cambio de esquema en una migración nueva. La primera migración incluye una copia inmutable del catálogo documental validado.

## Configuración del servidor

En Vercel, configurar `NASA_SYNC_DATABASE_URL` con el transaction pooler obtenido de Supabase, `NASA_SYNC_DATABASE_CA` con el certificado PEM de la CA de Supabase, `NASA_SYNC_TOKEN`, `NASA_SYNC_MISSION_ID=demo-mission` y `APP_MODE=cloud`. La conexión comprueba el certificado y el nombre del servidor. No usar `NEXT_PUBLIC_` para estos valores.

El proyecto requiere Node 22.x y la instalación desde la raíz del monorepo: `cd ../.. && npm ci --include=dev`. El comando de build es `npm run build`, ejecutado desde `src/backend`.

## Emisor local

Configurar `NASA_SYNC_ENDPOINT=https://astrovital-backend.vercel.app/api/v1/sync/measurements` y el mismo `NASA_SYNC_TOKEN` del receptor en `.env.local`. Ejecutar con Node 22:

```powershell
npm run sync:send
```

Este comando envía la cola cuando se invoca; no es un servicio programado de reconexión. Las cuentas y sesiones continúan siendo locales. Publicar el receptor no habilita las operaciones SQLite en la nube. No se ha migrado el login a Supabase Auth.

Los archivos `.env.supabase-deploy.local`, `.env.sync-cloud.local` y `.env.supabase-ca.crt` del equipo que provisiona contienen credenciales o material de conexión y están excluidos de Git. No compartirlos por mensajes ni subirlos al repositorio. Cada equipo debe recibir su configuración por un canal adecuado.
