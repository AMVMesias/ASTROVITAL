# Primer acceso y recuperación

Solo el administrador crea cuentas. No existe registro público.

Este documento desarrolla CU-11, CU-12 y MVP-10 a MVP-14 de la [especificación del MVP v0.9](ESPECIFICACION_MVP_NASA_HEALTH.md). Describe requisitos acordados; no certifica que estén implementados en el servidor.

## Comportamiento previsto

1. El administrador entrega al usuario sus credenciales iniciales.
2. Al autenticar, el backend indica si debe completar el primer acceso.
3. En ese caso, el usuario define una nueva contraseña y elige tres preguntas distintas del catálogo [`securityQuestions.ts`](../src/frontend/src/frontend/features/auth/securityQuestions.ts), con una respuesta para cada una.
4. El backend guarda la configuración y habilita el acceso normal al panel. Los accesos posteriores omiten esta configuración.
5. La recuperación solicita el usuario y muestra una sola de las tres preguntas guardadas, elegida al azar por el servidor. La pregunta permanece fija durante el desafío.
6. Se permiten tres respuestas incorrectas como máximo. El servidor debe mantener el contador y el bloqueo aunque se vuelva atrás, se recargue o se solicite otro desafío. Al agotarlos se solicita ayuda del administrador.
7. Solo tras verificar la respuesta en el servidor se autoriza temporalmente definir una nueva contraseña.

## Reglas de aceptación

- **Primer acceso obligatorio.** Aplica a cuentas nuevas de ambos roles. Validar las credenciales iniciales solo habilita una sesión limitada a completar la configuración y cerrar sesión. No permite el panel ni sus operaciones. La configuración queda pendiente si se interrumpe el proceso.
- **Contraseña nueva.** Debe ser diferente de la inicial, tener entre 12 y 128 caracteres y coincidir con su confirmación. El servidor debe validar estas reglas y guardar la contraseña mediante hash seguro.
- **Tres preguntas y tres respuestas.** Los tres desplegables usan el catálogo disponible, impiden repetir una pregunta y requieren una respuesta por pregunta. El servidor valida los IDs y la ausencia de duplicados. Una respuesta formada solo por espacios no es válida. Las respuestas se normalizan con NFKC, eliminación de espacios al principio y al final, y comparación sin distinguir mayúsculas; no se eliminan acentos ni espacios interiores.
- **Guardado completo.** La nueva contraseña, los tres IDs, sus respuestas protegidas y la finalización del primer acceso se guardan de forma atómica. Los accesos posteriores omiten la configuración. Un fallo conserva la cuenta pendiente, sin habilitar parcialmente el panel.
- **Desafío individual.** La recuperación muestra únicamente una pregunta de las tres configuradas. La elección aleatoria y la comparación se realizan en el servidor. La pregunta no cambia durante el desafío ni tras una respuesta incorrecta. Nunca se muestran las respuestas almacenadas ni se permite elegir otra pregunta para evitar el límite.
- **Tres intentos.** Cada respuesta incorrecta consume uno de los tres intentos de recuperación de la cuenta. El servidor actualiza el contador de forma atómica, incluso con solicitudes simultáneas. Al tercer fallo bloquea el flujo; volver atrás, recargar, cambiar de navegador, reiniciar el servidor o solicitar otro desafío no desbloquea la cuenta ni repone intentos.
- **Ayuda administrativa.** El bloqueo requiere intervención del administrador. El mecanismo administrativo de verificación y desbloqueo queda pendiente de definición e implementación; no hay desbloqueo automático en el flujo previsto. Si no se ha completado la configuración inicial, se indica solicitar ayuda al admin y no se ofrece una pregunta de ejemplo como mecanismo real de recuperación.
- **Restablecimiento autorizado.** Una respuesta correcta dentro del límite permite definir y confirmar la contraseña nueva. Se requiere una autorización temporal vinculada a la cuenta, de un solo uso y con caducidad definida por el backend. Cambiar la contraseña consume esa autorización y revoca sesiones y desafíos anteriores. La recuperación conserva las tres preguntas configuradas y conduce de nuevo al login.
- **Protección de datos.** Guardar respuestas mediante hashes seguros con sal; no almacenar respuestas en texto plano ni devolverlas en APIs, listados administrativos, registros o auditorías. Las verificaciones y el bloqueo pertenecen al servidor. La cuenta debe estar habilitada; la recuperación no elimina una inhabilitación administrativa. Los errores no deben exponer información sensible de otras cuentas.
- **Interfaz.** Mostrar los intentos restantes, errores de validación y el bloqueo. Mantener la transición entre apartados, el acceso por teclado y la preferencia de movimiento reducido. En pantallas pequeñas se permite scroll para conservar campos y controles accesibles.

La política de tres intentos corresponde a la recuperación por preguntas; es independiente del límite existente de fallos del login. Las pruebas de aceptación están en la sección 5.3 de la especificación.

## Estado de la interfaz

El backend ya cuenta con inicio de sesión, pero esta interfaz todavía no está conectada a él y la configuración de preguntas y recuperación siguen pendientes. El login recorre el primer acceso como demostración. Solo para probar el flujo, las tres preguntas y sus respuestas de ejemplo se conservan en memoria dentro del componente, asociadas al nombre de usuario; no se escriben en almacenamiento del navegador ni se envían. Usar datos ficticios. La recuperación permite probarlas sin recargar la página. Para usuarios sin configuración de ejemplo se elige entre las tres primeras preguntas y se muestra la respuesta ficticia `demo`.

Las respuestas de ejemplo se comparan ignorando mayúsculas y espacios al principio/final. El bloqueo y la pregunta se conservan al volver atrás durante esta sesión. Recargar reinicia la demostración; esto no es un control de seguridad real. Ningún recorrido autentica, persiste datos ni cambia contraseñas reales. Las pantallas lo indican expresamente.

La integración deberá sustituir estas transiciones por las respuestas del servidor: credenciales válidas, indicador de primer acceso, pregunta guardada, verificación de respuesta y autorización temporal para cambiar la contraseña. Los secretos y la verificación pertenecen al servidor. Un cambio de pantalla en React nunca debe autorizar el cambio real de contraseña.

Las transiciones respetan `prefers-reduced-motion` y llevan el foco al título del paso nuevo.
