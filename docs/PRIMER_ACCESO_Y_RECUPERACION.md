# Primer acceso y recuperación

El backend ya implementa este flujo. El frontend conserva su demostración local: todavía no llama a estos endpoints. Solo el admin crea cuentas; no hay registro público.

## Endpoints y permisos

Todos están documentados en Swagger (`http://localhost:3001/api/docs`). Las mutaciones requieren el Origin autorizado o `X-Nasa-Request: 1` para CLI. Respuestas con `Cache-Control: no-store`; no registrar contraseñas, respuestas ni tokens en logs.

| Método y ruta | Acceso y comportamiento |
| --- | --- |
| `GET /api/v1/auth/security-questions` | Público; devuelve los seis IDs y textos del catálogo del servidor |
| `GET /api/v1/auth/onboarding` | Sesión, incluso restringida; estado del primer acceso, preguntas elegidas sin respuestas y bloqueo de recuperación |
| `POST /api/v1/auth/onboarding` | Sesión restringida, o cuenta existente sin preguntas; nueva contraseña y tres respuestas en una transacción |
| `POST /api/v1/auth/recovery/start` | Público; recibe usuario y devuelve una pregunta aleatoria y un desafío de 10 minutos |
| `POST /api/v1/auth/recovery/verify` | Público; desafío y respuesta; máximo tres respuestas incorrectas persistidas por cuenta |
| `POST /api/v1/auth/recovery/reset` | Token de recuperación válido; contraseña nueva y confirmación; revoca sesiones y consume autorizaciones |
| `POST /api/v1/users/{id}/recovery/unlock` | Admin configurado; desbloquea recuperación conservando preguntas y contraseña; invalida desafíos/tokens anteriores |

Los endpoints de login y sesión ahora incluyen `user.requiresOnboarding`. Una cuenta creada por el admin tiene ese campo en `true`: puede consultar su identidad, cerrar sesión y completar el primer acceso. Las operaciones del panel y la ingesta de su dispositivo se deniegan hasta completar la configuración. La verificación siempre consulta la cuenta en servidor, no confía en un cambio de pantalla ni en un rol enviado por el cliente.

## Primer acceso: contrato para el frontend

1. Enviar usuario y contraseña inicial a `POST /api/v1/auth/login`. El navegador conserva la cookie HttpOnly.
2. Si `user.requiresOnboarding` es `true`, mostrar los pasos de contraseña y preguntas. Consultar el catálogo del servidor. La [copia actual del frontend](../src/frontend/src/frontend/features/auth/securityQuestions.ts) mantiene los mismos IDs; una prueba verifica esa correspondencia.
3. Al finalizar ambos pasos, enviar **una sola petición** a `POST /api/v1/auth/onboarding`:

```json
{
  "newPassword": "NuevaClaveLocal-2026!",
  "confirmation": "NuevaClaveLocal-2026!",
  "answers": [
    {"questionId": "first-pet", "answer": "Respuesta ficticia uno"},
    {"questionId": "childhood-city", "answer": "Respuesta ficticia dos"},
    {"questionId": "first-school", "answer": "Respuesta ficticia tres"}
  ]
}
```

4. El servidor exige contraseña distinta de la inicial, 12–128 caracteres y confirmación igual; exactamente tres preguntas admitidas y distintas, con respuestas no vacías de hasta 200 caracteres. Los datos incompletos no producen cambios parciales.
5. Guarda contraseña y respuestas mediante scrypt con sales aleatorias. Normaliza respuestas con trim, Unicode NFKC y minúsculas en español, igual que la demostración del frontend; no normaliza la contraseña.
6. Responde `{"status":"completed","requiresLogin":true}`, revoca todas las sesiones de esa cuenta y elimina la cookie de la petición. Iniciar sesión nuevamente con la contraseña nueva. No se reutiliza la sesión restringida.

No se puede repetir el primer acceso para reemplazar preguntas ya configuradas. La migración `005_auth_recovery` conserva acceso y contraseña de cuentas anteriores, y no les inventa respuestas: pueden configurar preguntas una vez mediante esta misma operación autenticada. El admin semilla queda habilitado para administrar desde el arranque; también puede configurar sus propias preguntas con una contraseña nueva si lo desea. Repetir `db:seed` no modifica contraseñas existentes ni elimina preguntas.

## Recuperar contraseña

### 1. Solicitar desafío

`POST /api/v1/auth/recovery/start`:

```json
{"username":"astronauta1"}
```

Respuesta con `challengeId`, `question: {id,label}`, `expiresAt` y `attemptsRemaining`. Para una cuenta configurada el servidor elige una de sus tres preguntas con aleatoriedad criptográfica. Una nueva solicitud reutiliza el mismo desafío y pregunta mientras siga vigente y sin verificar. No hay campo `exists` ni respuestas de ejemplo: las cuentas inexistentes, inhabilitadas o sin configuración reciben un desafío que no puede autorizar cambios.

### 2. Verificar respuesta

`POST /api/v1/auth/recovery/verify`:

```json
{"challengeId":"ID_DEVUELTO_POR_START","answer":"Respuesta del usuario"}
```

Una respuesta incorrecta devuelve `400 RECOVERY_INVALID`. La tercera devuelve `429 RECOVERY_LOCKED`. El contador se conserva por cuenta en SQLite, independientemente de recargar, cerrar el navegador, reiniciar el servidor, cambiar el nombre de usuario o renovar un desafío vencido. Vencimiento de desafío: `410 CHALLENGE_EXPIRED`; permite solicitar otro, conservando los intentos consumidos. Una entrada mal formada se rechaza antes de la comparación.

El bloqueo afecta a recuperación; no inhabilita la cuenta ni bloquea el login con contraseña válida. Solo el admin puede desbloquear tras agotar intentos. El servidor confirma la escritura del contador antes de devolver el error, de forma que una transacción revertida no permita intentos ilimitados.

Una respuesta válida devuelve `resetToken` y `expiresAt`. Ese token aleatorio tiene 256 bits, vence en cinco minutos y solo se guarda como SHA-256. El desafío se consume al verificarlo: no puede emitir otro token por repetición de la misma respuesta. No se cambia aún la contraseña.

### 3. Definir contraseña nueva

`POST /api/v1/auth/recovery/reset`:

```json
{
  "resetToken":"TOKEN_DEVUELTO_POR_VERIFY",
  "newPassword":"OtraClaveLocal-2026!",
  "confirmation":"OtraClaveLocal-2026!"
}
```

El servidor verifica token, vencimiento, estado de cuenta y bloqueo. Exige contraseña distinta de la anterior y aplica la misma política de longitud/confirmación. Un token inventado, vencido o usado devuelve `401 RESET_TOKEN_INVALID`.

El cambio de contraseña, la revocación de todas las sesiones y la eliminación de desafíos/tokens se confirman en una sola transacción. Las preguntas se conservan. Responde `{"status":"password_changed","requiresLogin":true}`; no inicia sesión automáticamente. Volver al login normal con la nueva contraseña.

## Asistencia del admin

`POST /api/v1/users/{id}/recovery/unlock` desbloquea los intentos, conserva preguntas y contraseña e invalida desafíos/tokens. Queda auditoría del admin que lo hizo. El astronauta no puede ejecutar esta operación.

Si el usuario olvidó también sus respuestas, el admin debe establecer una credencial inicial nueva mediante `PATCH /api/v1/users/{id}` con `password`. Esto elimina preguntas anteriores, exige primer acceso y revoca sesiones/desafíos/tokens. Cambios de rol e inhabilitación también invalidan autorizaciones de recuperación, sin borrar historial de salud. Los DTO administrativos nunca muestran respuestas ni hashes.

## Estado del frontend

No se modificó el frontend en esta entrega. Su login aún avanza sin pedir una sesión real; las preguntas, la respuesta `demo` y los intentos siguen siendo ejemplos en memoria. El flujo real anterior se prueba con Swagger o un cliente HTTP. La integración deberá sustituir las transiciones locales por estos contratos, gestionar `ONBOARDING_REQUIRED`, mostrar el contador de servidor y volver al login después de cada cambio de contraseña.

Las preguntas de conocimiento satisfacen el guion del prototipo; no deben considerarse por sí solas un mecanismo de recuperación adecuado para uso real. [OWASP recomienda combinarlas con otro método de recuperación](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#security-questions). No se implementan correo, SMS ni notificaciones externas en este alcance.

## Verificación

```sh
npm run db:migrate
npm run typecheck
npm run lint
npm test
npm run test:production
```

Las pruebas cubren restricción de primer acceso, rollback, hashes, normalización, pregunta fija, intentos tras reinicio, desbloqueo administrativo, vencimiento y uso único del token, revocación, cuentas inexistentes y el recorrido HTTP con cookies. La prueba de producción requiere compilar antes el backend; usa cuentas y bases temporales, sin cambiar credenciales reales.
