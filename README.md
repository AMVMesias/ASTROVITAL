# NASA Health

Prototipo de monitoreo de salud para NASA Space Apps 2026.

## Desarrollo local

Requiere Node.js 22 y npm.

```sh
npm ci
npm run dev
```

- `/` muestra el saludo de NASA Health.
- `GET /api/health` responde `200 OK` con `{"status":"ok"}` y comprueba que la API está disponible.

## Build de producción

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

En Windows, ejecutar `curl.exe -i http://localhost:3000/api/health` desde otra terminal para comprobar el endpoint.

## Arquitectura

- `src/app` contiene los puntos de entrada de Next.js para páginas y API.
- `src/frontend/presentation` contiene las vistas.
- `src/backend/application` contiene los casos de uso, independientes del transporte HTTP.

## Vercel

Importar el repositorio, seleccionar Next.js, usar la raíz como directorio del proyecto y configurar `main` como rama de producción con Node.js 22. El primer despliegue funciona sin variables de entorno. Verificar `/` y `/api/health` en la URL de producción.
