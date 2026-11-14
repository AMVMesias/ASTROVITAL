# NASA Health — Especificación de requisitos del sistema

**Versión:** 0.2 (borrador para revisión)  
**Fecha:** 14 de noviembre de 2026  
**Proyecto:** Aplicación web para monitoreo de indicadores de salud de astronautas  
**Estado:** Requisitos preliminares; sujetos a validación por el equipo

> **Alcance y precaución:** Esta especificación describe un prototipo académico/demostrativo inspirado en el reto de monitoreo de salud para misiones espaciales. No constituye un dispositivo médico ni una herramienta de diagnóstico. Los datos simulados y los avisos demostrativos deberán identificarse de forma explícita. Los sensores físicos y sus límites deberán documentarse.

## 1. Descripción general

NASA Health será una aplicación web para visualizar y dar seguimiento a indicadores de salud de astronautas durante misiones espaciales, empleando datos recibidos desde dispositivos físicos basados en ESP32 y/o datos simulados. Permitirá consultar indicadores actuales, evolución histórica, calidad de la información y avisos demostrativos.

### 1.1. Tecnologías previstas

| Componente | Tecnología / decisión | Estado |
|---|---|---|
| Frontend | Next.js + TypeScript | Propuesta seleccionada por el equipo |
| Backend | NestJS con arquitectura modular por capas | Propuesta seleccionada por el equipo |
| ORM | TypeORM | Propuesto |
| Base de datos | PostgreSQL | Propuesto |
| Microcontrolador | ESP32 | Previsto; modelo pendiente |
| Sensores | Modelos y variables por determinar | Pendiente |
| Comunicación ESP32–software | Bluetooth Low Energy (BLE), Wi-Fi u otra | Pendiente |
| Autenticación | Inicio de sesión obligatorio | **Confirmado** |
| Visualización | Dashboard, gráficos e historial | Propuesto |

### 1.2. Convenciones

- **RF:** requisito funcional; define qué debe hacer el sistema.
- **RNF:** requisito no funcional; define condiciones de calidad, seguridad o comportamiento.
- **RH:** requisito de hardware e integración física.
- **Alta:** necesario para la primera propuesta de prototipo.
- **Media:** deseable, sujeto al alcance final.
- Las prioridades son **propuestas**, no compromisos definitivos.

## 2. Requisitos funcionales (RF)

### 2.1. Autenticación y usuarios

| Código | Requisito | Prioridad |
|---|---|---|
| RF-01 | El sistema deberá permitir iniciar sesión mediante credenciales de usuario. | Alta |
| RF-02 | El sistema deberá validar las credenciales antes de permitir el acceso. | Alta |
| RF-03 | El sistema deberá permitir cerrar sesión. | Alta |
| RF-04 | El sistema deberá impedir que usuarios no autenticados accedan a funciones protegidas. | Alta |
| RF-05 | El sistema deberá mostrar mensajes de error cuando las credenciales sean incorrectas. | Alta |
| RF-06 | El sistema deberá permitir administrar los usuarios que tienen acceso a la aplicación. | Media |
| RF-07 | El sistema deberá restringir funcionalidades según los roles y permisos definidos. | Alta |

**Pendiente:** precisar identificador de inicio de sesión (por ejemplo, correo electrónico) y roles (administrador, operador, astronauta u otros). La existencia de un **login** sí está confirmada; los roles todavía no.

### 2.2. Gestión de astronautas y misiones

| Código | Requisito | Prioridad |
|---|---|---|
| RF-08 | El sistema deberá permitir registrar y administrar perfiles de astronautas. | Alta |
| RF-09 | El sistema deberá mostrar un listado de astronautas registrados. | Alta |
| RF-10 | El sistema deberá permitir consultar la información de un astronauta. | Alta |
| RF-11 | El sistema deberá permitir registrar misiones espaciales. | Media |
| RF-12 | El sistema deberá asociar astronautas con sus respectivas misiones. | Media |
| RF-13 | El sistema deberá permitir seleccionar un astronauta para visualizar sus indicadores de salud. | Alta |

### 2.3. Integración con ESP32 y sensores

| Código | Requisito | Prioridad |
|---|---|---|
| RF-14 | El sistema deberá permitir vincular un dispositivo ESP32 con un astronauta. | Alta |
| RF-15 | El sistema deberá recibir datos transmitidos por el ESP32. | Alta |
| RF-16 | El sistema deberá mostrar el estado de conexión del dispositivo. | Alta |
| RF-17 | El sistema deberá permitir establecer y finalizar la conexión con el dispositivo cuando el protocolo lo permita. | Alta |
| RF-18 | El sistema deberá identificar el sensor o dispositivo de origen de cada medición. | Alta |
| RF-19 | El sistema deberá detectar e informar interrupciones en la recepción de mediciones. | Alta |

**Pendiente:** definir modelo de placa, sensores, protocolo de conexión, equipo receptor y comportamiento ante pérdida de conexión.

### 2.4. Monitoreo de indicadores de salud

| Código | Requisito | Prioridad |
|---|---|---|
| RF-20 | El sistema deberá mostrar los indicadores de salud disponibles para cada astronauta. | Alta |
| RF-21 | El sistema deberá actualizar los valores mostrados al recibir nuevas mediciones. | Alta |
| RF-22 | El sistema deberá presentar cada indicador con su valor y unidad de medida. | Alta |
| RF-23 | El sistema deberá visualizar la evolución de los indicadores mediante gráficos temporales. | Alta |
| RF-24 | El sistema deberá mostrar la fecha y hora de la última medición recibida. | Alta |
| RF-25 | El sistema deberá permitir seleccionar un indicador para consultar su información detallada. | Media |

**Nota:** frecuencia cardíaca, temperatura y saturación de oxígeno son ejemplos de posibles indicadores, no sensores confirmados. Su incorporación dependerá del hardware y de las limitaciones de medición.

### 2.5. Historial y almacenamiento de mediciones

| Código | Requisito | Prioridad |
|---|---|---|
| RF-26 | El sistema deberá almacenar las mediciones recibidas en la base de datos. | Alta |
| RF-27 | El sistema deberá registrar la fecha, hora, valor, unidad, origen y astronauta asociado a cada medición. | Alta |
| RF-28 | El sistema deberá permitir consultar mediciones históricas. | Alta |
| RF-29 | El sistema deberá permitir filtrar mediciones por astronauta, indicador y período. | Alta |
| RF-30 | El sistema deberá representar gráficamente las mediciones históricas. | Alta |

### 2.6. Alertas y calidad de los datos

| Código | Requisito | Prioridad |
|---|---|---|
| RF-31 | El sistema deberá detectar períodos de ausencia de mediciones según un intervalo configurado. | Alta |
| RF-32 | El sistema deberá identificar mediciones inválidas o incompletas según reglas definidas. | Alta |
| RF-33 | El sistema deberá generar avisos demostrativos cuando se cumplan las condiciones configuradas. | Alta |
| RF-34 | El sistema deberá mostrar los avisos con su tipo, descripción y fecha. | Alta |
| RF-35 | El sistema deberá permitir consultar el historial de avisos. | Media |
| RF-36 | El sistema deberá diferenciar los avisos de calidad de datos de posibles cambios en los indicadores de salud. | Alta |

**Restricción:** los avisos no serán diagnósticos médicos. Cualquier umbral fisiológico utilizado con fines de demostración deberá estar justificado y etiquetado como **no validado clínicamente** cuando corresponda.

### 2.7. Simulación de datos

| Código | Requisito | Prioridad |
|---|---|---|
| RF-37 | El sistema deberá permitir utilizar datos simulados para demostrar el monitoreo. | Alta |
| RF-38 | El sistema deberá identificar claramente cuáles mediciones son simuladas. | Alta |
| RF-39 | El sistema deberá permitir representar escenarios de variación de indicadores mediante datos de prueba. | Media |
| RF-40 | El sistema deberá permitir probar situaciones de ausencia o datos inválidos mediante escenarios simulados. | Alta |

**Definición:** datos simulados son valores generados artificialmente para probar el sistema; no deben confundirse con mediciones captadas por sensores físicos.

### 2.8. Dashboard y reportes

| Código | Requisito | Prioridad |
|---|---|---|
| RF-41 | El sistema deberá proporcionar un dashboard con los indicadores principales del astronauta seleccionado. | Alta |
| RF-42 | El sistema deberá mostrar un resumen de las últimas mediciones y avisos. | Alta |
| RF-43 | El sistema deberá visualizar el estado de conexión de los dispositivos asociados. | Alta |
| RF-44 | El sistema deberá permitir generar consultas o reportes históricos por período. | Media |
| RF-45 | El sistema deberá permitir exportar los resultados de los reportes a un formato definido. | Media |

**Pendiente:** decidir si los reportes se exportarán a CSV, PDF u otro formato.

## 3. Requisitos no funcionales (RNF)

| Código | Requisito |
|---|---|
| RNF-01 | El frontend y backend deberán comunicarse mediante conexiones seguras HTTPS en el despliegue. |
| RNF-02 | El sistema deberá almacenar las contraseñas mediante hashes seguros, nunca en texto plano. |
| RNF-03 | Los endpoints protegidos deberán comprobar la autenticación y los permisos correspondientes. |
| RNF-04 | El sistema deberá proteger la información personal y limitar su exposición a usuarios autorizados. |
| RNF-05 | El sistema deberá validar los datos antes de almacenarlos. |
| RNF-06 | Las mediciones deberán conservar información que permita identificar su origen real o simulado. |
| RNF-07 | La aplicación deberá mostrar claramente cuándo una medición está desactualizada. |
| RNF-08 | El sistema deberá manejar errores de conexión sin mostrar resultados falsos como mediciones actuales. |
| RNF-09 | El sistema deberá utilizar una estructura modular que facilite las modificaciones y ampliaciones. |
| RNF-10 | La API deberá contar con documentación técnica de sus endpoints. |
| RNF-11 | El sistema deberá disponer de pruebas para las operaciones y validaciones principales. |
| RNF-12 | Las interfaces deberán adaptarse a los tamaños de pantalla definidos para el proyecto. |
| RNF-13 | La aplicación deberá ser compatible con los navegadores seleccionados para el prototipo. |
| RNF-14 | El sistema deberá registrar fechas de forma consistente, utilizando UTC para el almacenamiento. |
| RNF-15 | El sistema deberá documentar las limitaciones de los sensores, los datos simulados y las reglas de aviso. |

**Pendiente de cuantificar:** tiempo máximo de actualización, cantidad de dispositivos concurrentes, disponibilidad esperada, resolución de pantalla objetivo y políticas de retención de datos.

## 4. Requisitos de hardware e integración (RH)

| Código | Requisito propuesto |
|---|---|
| RH-01 | Utilizar un microcontrolador ESP32 compatible con los sensores seleccionados. |
| RH-02 | Identificar y documentar el modelo de cada sensor. |
| RH-03 | Definir las variables, unidades y frecuencia de muestreo. |
| RH-04 | Definir el protocolo utilizado para enviar las mediciones. |
| RH-05 | Establecer un formato común de datos entre el ESP32 y el software. |
| RH-06 | Registrar un identificador de dispositivo y una marca temporal para las mediciones. |
| RH-07 | Definir el comportamiento ante pérdida de conexión o reinicio del dispositivo. |
| RH-08 | Verificar que el equipo receptor sea compatible con el protocolo seleccionado. |

## 5. Pantallas previstas de la aplicación web

Estas pantallas son una **propuesta derivada** de los requisitos, no diseños finales:

| Pantalla | Función principal | Requisitos relacionados |
|---|---|---|
| Inicio de sesión | Autenticar al usuario. | RF-01 a RF-05 |
| Dashboard | Resumir indicadores, últimas mediciones, avisos y dispositivos conectados. | RF-41 a RF-43 |
| Astronautas | Listar, registrar y consultar astronautas. | RF-08 a RF-10 |
| Misiones | Registrar misiones y asociarlas a astronautas. | RF-11 y RF-12 |
| Monitoreo | Consultar mediciones actualizadas y evolución de indicadores. | RF-13 y RF-20 a RF-25 |
| Historial | Filtrar y graficar mediciones históricas. | RF-26 a RF-30 |
| Dispositivos | Vincular ESP32, visualizar estado y conexión. | RF-14 a RF-19 |
| Avisos | Consultar problemas de calidad, ausencia de datos y alertas demostrativas. | RF-31 a RF-36 |
| Simulación | Ejecutar pruebas con datos ficticios etiquetados. | RF-37 a RF-40 |
| Reportes | Consultar y exportar resultados históricos. | RF-44 y RF-45 |
| Administración de usuarios | Gestionar cuentas y permisos. | RF-06 y RF-07 |

## 6. Entidades de datos preliminares

**Modelo conceptual sujeto a revisión**, especialmente después de elegir el hardware:

| Entidad | Información principal |
|---|---|
| Usuario | Cuenta, credenciales almacenadas de manera segura y permisos. |
| Astronauta | Identificador y datos de perfil. |
| Misión | Identificador, nombre y período. |
| Participación | Relación entre astronauta y misión. |
| Dispositivo | Identificador, modelo y estado. |
| Sensor | Identificador, tipo y dispositivo asociado. |
| Indicador | Tipo de variable, descripción y unidad. |
| Medición | Valor, fecha, astronauta, indicador, sensor/origen y calidad. |
| Alerta | Tipo, descripción, fecha y estado. |

## 7. Arquitectura técnica prevista

```text
Sensores físicos
      ↓
ESP32
      ↓  (protocolo pendiente: BLE / Wi-Fi / otro)
Receptor o servicio de ingesta (por definir)
      ↓
Backend NestJS (módulos y capas)
      ↕
PostgreSQL
      ↑
Frontend Next.js (dashboard, historial, avisos y administración)
```

> **Nota de integración:** si se selecciona BLE desde el navegador, habrá que validar compatibilidad y permisos del equipo receptor. Si se selecciona Wi-Fi, habrá que definir el método de ingesta de datos y la red disponible. Este diagrama no fija todavía la ruta exacta de transmisión.

### 7.1. Capas propuestas en módulos de NestJS

- **Controller:** recibe peticiones HTTP y devuelve respuestas.
- **Service:** ejecuta reglas de negocio y coordina operaciones.
- **Repository:** encapsula acceso a PostgreSQL mediante TypeORM, cuando convenga crear esta capa explícita.
- **Entity:** representa tablas y relaciones.
- **DTO:** define y valida datos de intercambio.
- **Module:** registra las dependencias de cada módulo.

### 7.2. Módulos propuestos

`auth/`, `usuarios/`, `astronautas/`, `misiones/`, `indicadores/`, `mediciones/`, `alertas/`, `reportes/` y, si las necesidades lo justifican, `dashboard/` y `dispositivos/`.

## 8. Decisiones confirmadas y pendientes

### 8.1. Confirmadas por el equipo o expresadas como intención

- Se construirá una **aplicación web**.
- Se ha escogido **Next.js** para el frontend.
- Se ha planteado **NestJS por módulos y capas** para el backend.
- Se **utilizará un inicio de sesión** para controlar el acceso a la web.
- Se **prevé usar ESP32** con elementos físicos, todavía sin modelos de sensores confirmados.

### 8.2. Preguntas pendientes de definición

1. ¿Qué modelo exacto de ESP32 se utilizará?
2. ¿Qué sensores tendrán físicamente y qué indicadores permiten obtener?
3. ¿Se transmitirá mediante Wi-Fi, BLE u otro protocolo? ¿Quién será el receptor?
4. ¿Cuántos astronautas, sensores y dispositivos se manejarán en el prototipo?
5. ¿Qué roles existirán y qué acciones podrá realizar cada uno?
6. ¿Qué datos serán físicos y cuáles simulados?
7. ¿Cada cuánto se generarán y visualizarán las mediciones?
8. ¿Qué sucederá cuando se pierda internet o la conexión con el ESP32?
9. ¿Los dispositivos almacenarán temporalmente los datos hasta reconectarse?
10. ¿Cuáles serán las reglas de calidad de datos y los avisos demostrativos?
11. ¿Qué formatos de exportación de reportes se requieren?
12. ¿En qué navegadores y equipos deberá ejecutarse la demostración?
13. ¿Se aceptará registro público de usuarios o solo cuentas creadas por un administrador?
14. ¿Qué información personal se registrará y cuánto tiempo se conservará?

## 9. Alcance del primer prototipo

Para un primer MVP, se **propone priorizar**: inicio de sesión, perfiles de astronautas, lectura de datos (reales y/o simulados), dashboard de indicadores, almacenamiento de mediciones, historial y avisos de ausencia/calidad. Misiones, exportaciones y administración avanzada pueden incorporarse según el tiempo disponible.

**No se considera parte del prototipo:** diagnósticos médicos, recomendaciones clínicas automatizadas ni afirmaciones de validación médica de sensores o algoritmos no certificados.

## 10. Resumen de requisitos

| Categoría | Cantidad |
|---|---:|
| Funcionales (RF) | 45 |
| No funcionales (RNF) | 15 |
| Hardware e integración (RH) | 8 |
| **Total de requisitos propuestos** | **68** |

**Próximo paso recomendado:** validar los puntos pendientes de la sección 8 para transformar este borrador en una especificación aprobada, verificable y trazable antes de implementar.
