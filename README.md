# NASA Health

Prototipo de monitoreo de salud para NASA Space Apps 2026.

## Arquitectura

- `src/frontend/`: aplicación Next.js con páginas, componentes y recursos públicos.
- `src/backend/`: aplicación Next.js independiente con la API y la lógica de negocio.
- `scripts/` y `tests/`: herramientas y pruebas del repositorio.

El frontend redirige `/api/*` al backend mediante un proxy para conservar las cookies y las comprobaciones de origen.

## Desarrollo local

Se requiere Node.js 22.13 o superior dentro de la rama 22. Desde la raíz, ejecuta `npm ci`. Copia `src/backend/.env.example` a `src/backend/.env.local` y `src/frontend/.env.example` a `src/frontend/.env.local`. Configura las credenciales locales según [BACKEND_PERSONA_1.md](docs/BACKEND_PERSONA_1.md).

En terminales separadas, desde la raíz, ejecuta `npm run dev:backend` y `npm run dev:frontend`. El frontend está en http://localhost:3000 y la API en http://localhost:3001/api. Swagger está en http://localhost:3000/api/docs.

`APP_ORIGIN` debe coincidir exactamente con el origen público del frontend. `SQLITE_PATH` se resuelve desde el directorio desde el que se inicia el backend; los comandos anteriores usan la raíz.

## Verificación y producción

Ejecuta `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `npm run test:production`. Para iniciar las compilaciones, usa `npm run start:backend` y `npm run start:frontend` en terminales separadas.

Para desplegar, configura ambos servicios por separado y establece `BACKEND_URL` en el frontend y `APP_ORIGIN` en el backend. La URL del backend debe ser accesible desde el servidor del frontend. El backend local usa SQLite y no ofrece persistencia en Vercel; consulta la documentación del backend antes de desplegarlo.

## Backend de Persona 2

El catálogo documental conserva cuatro escenarios y su revisión. Los avisos y las asignaciones se guardan en SQLite. La recepción de mediciones en PostgreSQL usa `POST /api/v1/sync/measurements`.

```sh
node --import tsx scripts/seed-environment.mjs <ruta.sqlite>
node --import tsx --test tests/environment.test.mjs tests/persona2.test.mjs
node --import tsx scripts/provision-sync.mjs
```

Para provisionar la base, exporta `NASA_SYNC_DATABASE_URL` en la terminal que ejecuta el script. Para arrancar el receptor, configura esa variable en el entorno del backend. El servidor también requiere `NASA_SYNC_TOKEN` y `NASA_SYNC_MISSION_ID` para autorizar al equipo local dentro de su misión. La prueba HTTP usa una base PostgreSQL de pruebas y requiere `NASA_SYNC_TEST_DATABASE_URL`, `NASA_SYNC_TEST_ENDPOINT` y el mismo token del servidor. Ejecutar `node --import tsx --test tests/postgres-sync.test.mjs`.

Las migraciones de entorno y avisos ya se registran en la conexión SQLite común. Al guardar una medición, captura proporciona el historial a `evaluatePersistedMeasurement`. El módulo de acceso verifica la sesión antes de seleccionar un escenario o habilitar operaciones de avisos. El emisor consume la cola SQLite con `npm run sync:send`. Configura `NASA_SYNC_ENDPOINT` con la URL completa del receptor y `NASA_SYNC_TOKEN` con la credencial del equipo. El receptor acepta perfiles provisionados en PostgreSQL y conserva un rechazo individual si una medición usa el perfil provisional `preparation-1`. La captura ya usa asignaciones ambientales históricas y ejecuta evaluación post-commit con trabajos recuperables mediante `npm run assessment:retry`.

Consulta la [especificación del MVP](docs/ESPECIFICACION_MVP_NASA_HEALTH.md), el [plan del backend](docs/PLAN_BACKEND_MVP.md) y el [primer acceso](docs/PRIMER_ACCESO_Y_RECUPERACION.md) en [docs/](docs/).

## Puente de Persona 1

Captura USB Serial del sketch AD8232 y transporte BLE configurable, con cola durable hacia la API local y estados de pérdida de señal. Ver [instalación, contrato y pruebas](docs/PUENTE_ESP32.md). El firmware aportado todavía no implementa BLE; la prueba física requiere placa y UUID confirmados. No se modificó el frontend en esta entrega.

## Primer acceso y recuperación en backend

Disponibles el catálogo de preguntas, configuración inicial transaccional, desafío con tres intentos persistentes y cambio de contraseña con token temporal de un solo uso. Las cuentas nuevas tienen sesión restringida hasta completar el primer acceso. Ver [contratos y ejemplos](docs/PRIMER_ACCESO_Y_RECUPERACION.md). La interfaz aún conserva su demo local y requiere integración.
