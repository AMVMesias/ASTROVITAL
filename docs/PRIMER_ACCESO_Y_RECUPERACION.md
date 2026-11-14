# Primer acceso y recuperación

Solo el administrador crea cuentas. No existe registro público.

## Comportamiento previsto

1. El administrador entrega al usuario sus credenciales iniciales.
2. Al autenticar, el backend indica si debe completar el primer acceso.
3. En ese caso, el usuario define una nueva contraseña y elige tres preguntas distintas del catálogo [`securityQuestions.ts`](../src/frontend/src/frontend/features/auth/securityQuestions.ts), con una respuesta para cada una.
4. El backend guarda la configuración y habilita el acceso normal al panel. Los accesos posteriores omiten esta configuración.
5. La recuperación solicita el usuario y muestra una sola de las tres preguntas guardadas, elegida al azar por el servidor. La pregunta permanece fija durante el desafío.
6. Se permiten tres respuestas incorrectas como máximo. El servidor debe mantener el contador y el bloqueo aunque se vuelva atrás, se recargue o se solicite otro desafío. Al agotarlos se solicita ayuda del administrador.
7. Solo tras verificar la respuesta en el servidor se autoriza temporalmente definir una nueva contraseña.

## Estado de la interfaz

El backend ya cuenta con inicio de sesión, pero esta interfaz todavía no está conectada a él y la configuración de preguntas y recuperación siguen pendientes. El login recorre el primer acceso como demostración. Solo para probar el flujo, las tres preguntas y sus respuestas de ejemplo se conservan en memoria dentro del componente, asociadas al nombre de usuario; no se escriben en almacenamiento del navegador ni se envían. Usar datos ficticios. La recuperación permite probarlas sin recargar la página. Para usuarios sin configuración de ejemplo se elige entre las tres primeras preguntas y se muestra la respuesta ficticia `demo`.

Las respuestas de ejemplo se comparan ignorando mayúsculas y espacios al principio/final. El bloqueo y la pregunta se conservan al volver atrás durante esta sesión. Recargar reinicia la demostración; esto no es un control de seguridad real. Ningún recorrido autentica, persiste datos ni cambia contraseñas reales. Las pantallas lo indican expresamente.

La integración deberá sustituir estas transiciones por las respuestas del servidor: credenciales válidas, indicador de primer acceso, pregunta guardada, verificación de respuesta y autorización temporal para cambiar la contraseña. Los secretos y la verificación pertenecen al servidor. Un cambio de pantalla en React nunca debe autorizar el cambio real de contraseña.

Las transiciones respetan `prefers-reduced-motion` y llevan el foco al título del paso nuevo.
