# NASA Health

Prototipo de monitoreo de salud para NASA Space Apps 2026.

Backend de persona 1 implementado: acceso, usuarios, captura, historial, SQLite y
cola local. Swagger: `/api/docs`; OpenAPI: `/api/openapi`.
Consultar [preparaci贸n, contratos y pruebas](BACKEND_PERSONA_1.md).
La integraci贸n con el frontend queda pendiente por instrucci贸n del usuario.

## Desarrollo local

Requiere Node.js 22.13 o superior dentro de la rama 22 y npm.

```sh
npm ci
npm run dev
```

- `/` muestra la p谩gina de inicio basada en la referencia visual, con dise帽o adaptable, imagen espacial generada e iconos SVG personalizados.
- `GET /api/health` responde `200 OK` con `{"status":"ok"}` y comprueba que la API est谩 disponible.

## Build de producci贸n

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

En Windows, ejecutar `curl.exe -i http://localhost:3000/api/health` desde otra terminal para comprobar el endpoint.

## Arquitectura

- `src/app` contiene los puntos de entrada de Next.js para p谩ginas y API.
- `src/frontend/presentation` contiene las vistas.
- `src/backend/application` contiene los casos de uso, independientes del transporte HTTP.

## Vercel

Importar el repositorio, seleccionar Next.js, usar la ra铆z como directorio del proyecto y configurar `main` como rama de producci贸n con Node.js 22. El primer despliegue funciona sin variables de entorno. Verificar `/` y `/api/health` en la URL de producci贸n.

## Frontend

Se mantiene una sola aplicaci贸n Next.js en la ra铆z para conservar el backend existente.
La arquitectura propuesta se adapta as铆:

- `public/images`: logotipo NASA y fotograf铆a espacial generada con IA.
- `public/icons`: iconos SVG de salud, indicadores y seguridad.
- `src/app`: rutas, estilos globales y layout ra铆z.
- `src/app/(auth)/login`: formulario de acceso de demostraci贸n, sin autenticaci贸n real.
- `src/app/(panel)`: layout y rutas iniciales de dashboard, usuarios, nuevo usuario, reportes y configuraci贸n. Son m贸dulos pendientes de implementar.
- `src/frontend/presentation`: p谩gina de inicio.
- `src/frontend/components/layout`: cabecera, marca y pie reutilizables.
- `src/frontend/components/ui`: iconos compartidos y espacio para controles.
- `src/frontend/features`: m贸dulos auth, usuarios, dashboard y reportes.
- `src/frontend/hooks`, `providers`, `types`: carpetas reservadas con `.gitkeep`.
- `src/frontend/lib/api.ts`: cliente HTTP para futura integraci贸n.

Las rutas `/acerca`, `/recursos` y `/legal` contienen informaci贸n inicial del prototipo.
Copiar `.env.example` a `.env.local` si se necesita configurar la URL de la API.
El logotipo proviene de https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo.svg.
La fotograf铆a es una recreaci贸n generada; no es la fotograf铆a exacta de la referencia.

## Verificaci髇 visual

`output/desktop.png` y `output/mobile.png` muestran el resultado renderizado.
`output/comparativa.png` coloca la referencia a la izquierda y la implementaci髇 a la derecha.
Se conservan la composici髇, la curva, los textos y la paleta. La tipograf韆 del sistema,
los iconos vectoriales y la fotograf韆 generada producen diferencias visuales frente a la referencia.

Validaci髇: lint, TypeScript y build de producci髇; navegaci髇 al login, aviso del formulario,
ausencia de desbordamiento horizontal a 1672 y 390 px, y respuesta de `/api/health`.
