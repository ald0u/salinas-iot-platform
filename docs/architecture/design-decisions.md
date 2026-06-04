# Decisiones de Diseño — Salinas IoT Platform

Este documento justifica las decisiones técnicas de la solución. Sirve de respaldo para el
video explicativo y para sustentar la entrega ante el equipo evaluador.

---

## 1. "Cloud-ready, ejecución local" (decisión central)

**Decisión:** la solución se **diseña para AWS** pero se **ejecuta localmente** con equivalentes,
conmutables por variables de entorno.

**Por qué:**
- Permite desarrollar, demostrar y evaluar la solución **sin costos ni dependencia de una cuenta AWS**.
- El código no se "casa" con AWS: el mismo backend procesa lecturas vengan de IoT Core (MQTT) o de
  un POST HTTP. Solo cambia el **transporte**, no la lógica.
- Demuestra una práctica real de la industria: *paridad dev/prod* y *12-factor app* (config por entorno).

| Componente AWS (diseño)   | Equivalente local (ejecución)                              |
|---------------------------|------------------------------------------------------------|
| AWS IoT Core (MQTT/TLS)   | Gateway → HTTP `POST /readings/batch` (`MQTT_MODE=local`)   |
| DynamoDB                  | DynamoDB Local (contenedor Docker)                         |
| Lambda / EC2 receptor     | Backend Node.js en contenedor                              |
| API Gateway (REST + WS)   | Express + Socket.io                                        |
| S3 + CloudFront           | Frontend Angular servido localmente / VPS                  |

---

## 2. DynamoDB con single-table design

**Decisión:** una sola tabla (`IoTData`) para Devices, Readings, Alerts, Users y Refresh Tokens,
con un índice global secundario (GSI1) y TTL.

**Por qué:**
- **Escala** para 500+ dispositivos y miles de lecturas/min sin administrar servidores de BD.
- **TTL automático**: las lecturas se borran solas a los 30 días y los refresh tokens a los 7 días,
  sin necesidad de jobs de limpieza.
- **GSI1** resuelve los accesos no-primarios: usuarios por email (`EMAIL#<email>`) y alertas por
  dispositivo (`DEVICE#<id>`), sin escaneos costosos.
- Single-table reduce número de tablas, costos y latencia (menos round-trips).

**Patrón de claves:**
- `DEVICE#<id>` + `METADATA` → dispositivo
- `DEVICE#<id>` + `READING#<timestamp>#<uuid>` → lectura (ordenable por tiempo)
- `ALERT#<id>` + `METADATA`, con `GSI1PK = DEVICE#<id>` → alerta consultable por dispositivo
- `USER#<id>` + `METADATA`, con `GSI1PK = EMAIL#<email>` → usuario consultable por email

---

## 3. IoT Gateway dual-mode

**Decisión:** el publisher del simulador soporta dos modos (`local` / `aws`) por variable de entorno.

**Por qué:**
- En desarrollo no se necesita IoT Core: publica por HTTP directo al backend.
- En producción usa MQTT/TLS con certificados X.509 al topic `dt/devices/{deviceId}/telemetry`.
- El payload JSON es idéntico en ambos casos, así que el backend no distingue el origen.

---

## 4. Autenticación: JWT access + refresh con rotación

**Decisión:** access token de 15 min + refresh token de 7 días con **rotación** (cada refresh
invalida el anterior y emite uno nuevo), almacenado en DynamoDB con TTL.

**Por qué:**
- Access token corto → ventana de exposición mínima si se filtra.
- Refresh token rotativo → mitiga el robo de tokens (un refresh reutilizado se detecta/invalida).
- TTL en DynamoDB → los refresh tokens caducados se eliminan solos.
- Rate limiting (5 intentos/min) en login → frena fuerza bruta.

---

## 5. Tiempo real con WebSocket (Socket.io)

**Decisión:** Socket.io para empujar eventos a los clientes, con salas (rooms) por dispositivo y rack.

**Por qué:**
- El monitoreo de un data center exige latencia baja: *push* > *polling*.
- Las **rooms** permiten que cada cliente reciba solo lo que le interesa (un rack, un dispositivo),
  reduciendo tráfico.
- Eventos: `device:reading`, `device:status`, `alert:new`, `alert:resolved`, `dashboard:update`.

---

## 6. Seguridad y robustez transversal

- **Helmet** (cabeceras seguras), **CORS** configurable, **sanitización** de inputs.
- **Joi** para validación de todos los payloads.
- **Error handler centralizado** + **logging estructurado** (Winston JSON) para trazabilidad.
- **Paginación cursor-based** → estable y eficiente sobre grandes volúmenes.
- **Caché en memoria** (TTL 10 s) para KPIs del dashboard → evita recalcular en cada request.

---

## 7. Empaquetado y despliegue

**Decisión:** todo en `docker-compose` para desarrollo; AWS CDK como IaC para producción.

**Por qué:**
- `docker-compose up` levanta el stack completo (BD, backend, gateway) de forma reproducible.
- La BD se inicializa y siembra automáticamente al arrancar (sin pasos manuales).
- CDK describe la infraestructura AWS como código, versionable y repetible.
