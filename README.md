# NASA Health

Prototipo de monitoreo de salud para NASA Space Apps 2026.

## Arquitectura

- `src/frontend/`: aplicación Next.js con páginas, componentes y recursos públicos.
- `src/backend/`: aplicación Next.js independiente con la API y la lógica de negocio.
- `scripts/` y `tests/`: herramientas y pruebas del repositorio.

El frontend redirige `/api/*` al backend mediante un proxy para conservar las cookies y las comprobaciones de origen.

## Desarrollo local

Se requiere Node.js 22.13 o superior dentro de la rama 22. Desde la raíz, ejecuta `npm ci`. Copia `src/backend/.env.example` a `src/backend/.env.local` y `src/frontend/.env.example` a `src/frontend/.env.local`. Configura las credenciales locales según [BACKEND_PERSONA_1.md](BACKEND_PERSONA_1.md).

En terminales separadas, desde la raíz, ejecuta `npm run dev:backend` y `npm run dev:frontend`. El frontend está en http://localhost:3000 y la API en http://localhost:3001/api. Swagger está en http://localhost:3000/api/docs.

`APP_ORIGIN` debe coincidir exactamente con el origen público del frontend. `SQLITE_PATH` se resuelve desde el directorio desde el que se inicia el backend; los comandos anteriores usan la raíz.

## Verificación y producción

Ejecuta `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `npm run test:production`. Para iniciar las compilaciones, usa `npm run start:backend` y `npm run start:frontend` en terminales separadas.

Para desplegar, configura ambos servicios por separado y establece `BACKEND_URL` en el frontend y `APP_ORIGIN` en el backend. La URL del backend debe ser accesible desde el servidor del frontend. El backend local usa SQLite y no ofrece persistencia en Vercel; consulta la documentación del backend antes de desplegarlo.
