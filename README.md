# Salinas IoT Platform — Monitoreo de Centro de Datos en Tiempo Real

Plataforma de monitoreo en tiempo real para dispositivos IoT desplegados en un centro de datos
(sensores de temperatura, humedad, consumo eléctrico, estado de UPS y sistemas de enfriamiento).

Permite monitorear el estado de 500+ dispositivos, generar alertas cuando los valores exceden
umbrales configurables, visualizar históricos y tendencias, gestionar dispositivos (CRUD completo)
y autenticación segura con roles (Admin, Operator, Viewer).

> **Prueba Técnica — Grupo Salinas DC**

---

## Tabla de contenido

- [Arquitectura](#-arquitectura)
- [Stack tecnológico](#-stack-tecnológico)
- [Decisión de diseño: "Cloud-ready, ejecución local"](#-decisión-de-diseño-cloud-ready-ejecución-local)
- [Requisitos previos](#-requisitos-previos)
- [Despliegue local (Docker)](#-despliegue-local-docker-recomendado)
- [Despliegue manual (sin Docker)](#-despliegue-manual-sin-docker)
- [Variables de entorno](#-variables-de-entorno)
- [Usuarios por defecto](#-usuarios-por-defecto)
- [Endpoints de la API](#-endpoints-de-la-api)
- [Documentación Swagger / Postman](#-documentación-swagger--postman)
- [WebSocket (tiempo real)](#-websocket-tiempo-real)
- [IoT Gateway / Simulador](#-iot-gateway--simulador)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Despliegue en AWS (diseño)](#-despliegue-en-aws-diseño)
- [Video explicativo](#-video-explicativo)

---

## 🏗 Arquitectura

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  IoT Gateway (demonio Node.js en Docker)                                      │
│   Simuladores: Temp · Humedad · Power · UPS · Cooling                         │
│                          │                                                     │
│                          ▼                                                     │
│                   MQTT Publisher (dual-mode)                                   │
│       MQTT_MODE=local ─── HTTP POST /api/v1/readings/batch ──┐ (demo actual)   │
│       MQTT_MODE=aws   ─── MQTT/TLS → AWS IoT Core ───────────┘ (diseño cloud)  │
└──────────────────────────────────────────────────────────────┼───────────────┘
                                                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Backend Node.js / Express  (en AWS: Lambda o EC2)                            │
│   1. Persiste la lectura en DynamoDB                                          │
│   2. Evalúa umbrales del dispositivo → genera alertas                         │
│   3. Emite eventos por WebSocket a los clientes suscritos                      │
│                                                                                │
│   REST API /api/v1 (JWT + RBAC)      WebSocket (Socket.io)                     │
└───────────────┬───────────────────────────────────┬───────────────────────────┘
                ▼                                     ▼
        ┌──────────────┐                     ┌─────────────────────┐
        │  DynamoDB    │                     │  Frontend Angular   │
        │  single-table│                     │  (S3 + CloudFront)  │
        │  + GSI1 + TTL│                     └─────────────────────┘
        └──────────────┘
```

> El diagrama completo y justificado está en [`docs/architecture/`](docs/architecture/).

---

## 🧰 Stack tecnológico

| Capa            | Tecnología |
|-----------------|------------|
| Backend         | Node.js + Express 5 + TypeScript |
| Base de datos   | DynamoDB (single-table design) — local con **DynamoDB Local** |
| Tiempo real     | Socket.io (WebSocket) |
| Autenticación   | JWT (access 15 min + refresh 7 días con rotación) + bcrypt |
| Validación      | Joi |
| Seguridad       | Helmet, CORS, sanitización de inputs, rate limiting |
| Logging         | Winston (estructurado JSON) |
| Caché de KPIs   | node-cache (TTL 10 s) |
| Documentación   | Swagger / OpenAPI 3 |
| IoT Gateway     | Node.js (demonio), publisher dual-mode (HTTP / MQTT) |
| Frontend        | Angular + TypeScript *(en construcción)* |
| Infraestructura | Docker + docker-compose · AWS CDK *(diseño)* |

---

## 💡 Decisión de diseño: "Cloud-ready, ejecución local"

La solución está **diseñada para AWS** (IoT Core, DynamoDB, Lambda/EC2, API Gateway, S3 + CloudFront),
pero para desarrollo y demostración **sin incurrir en costos de nube** todo corre en `docker-compose`
con equivalentes locales. El código está preparado para conmutar a AWS real **solo cambiando variables
de entorno**.

| Componente AWS (diseño)   | Equivalente local (ejecución actual)                       |
|---------------------------|------------------------------------------------------------|
| AWS IoT Core (MQTT/TLS)   | Gateway publica vía HTTP `POST /readings/batch` (`MQTT_MODE=local`) |
| DynamoDB                  | DynamoDB Local (contenedor)                                 |
| Lambda / EC2 receptor     | Backend Node.js en contenedor                              |
| API Gateway (REST + WS)   | Express + Socket.io                                        |
| S3 + CloudFront           | Frontend Angular servido localmente                        |

El payload de telemetría y la lógica de ingesta son **idénticos** en ambos modos; solo cambia el transporte.

---

## ✅ Requisitos previos

- [Docker](https://www.docker.com/) y Docker Compose
- (Opcional, para despliegue manual) Node.js >= 18

---

## 🚀 Despliegue local (Docker, recomendado)

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd salinas-iot-platform

# 2. Levantar todos los servicios (DynamoDB Local, backend, gateway, admin)
docker-compose up --build
```

Esto levanta:

| Servicio        | URL                          | Descripción                       |
|-----------------|------------------------------|-----------------------------------|
| Backend REST    | http://localhost:3000        | API REST `/api/v1`                |
| Backend WS      | ws://localhost:3001          | WebSocket (tiempo real)           |
| Swagger UI      | http://localhost:3000/docs   | Documentación interactiva         |
| Health check    | http://localhost:3000/health | Estado del servicio               |
| DynamoDB Local  | http://localhost:8000        | Base de datos                     |
| DynamoDB Admin  | http://localhost:8001        | Visor de tablas/datos             |

**Inicializar la base de datos** (la primera vez, en otra terminal):

```bash
# Crear la tabla single-table con índices y TTL
docker-compose exec backend npm run db:init

# Crear el usuario administrador inicial
docker-compose exec backend npm run db:seed
```

Una vez sembrado, el **IoT Gateway** empieza a generar lecturas automáticamente y el backend las procesa,
evalúa umbrales, genera alertas y las emite por WebSocket.

---

## 🛠 Despliegue manual (sin Docker)

Requiere una instancia de DynamoDB Local corriendo en `http://localhost:8000`.

```bash
# Backend
cd backend
npm install
npm run build
npm run db:init     # crea la tabla
npm run db:seed     # crea el admin
npm run start       # o: npm run dev (hot-reload)

# IoT Gateway (en otra terminal)
cd iot-gateway
npm install
npm run dev
```

---

## 🔐 Variables de entorno

### Backend

| Variable               | Descripción                                  | Default                    |
|------------------------|----------------------------------------------|----------------------------|
| `PORT`                 | Puerto REST                                  | `3000`                     |
| `WS_PORT`              | Puerto WebSocket                             | `3001`                     |
| `DYNAMODB_ENDPOINT`    | Endpoint de DynamoDB                         | `http://localhost:8000`    |
| `DYNAMODB_REGION`      | Región AWS                                   | `us-east-1`                |
| `DYNAMODB_TABLE`       | Nombre de la tabla single-table              | `IoTData`                  |
| `JWT_ACCESS_SECRET`    | Secreto del access token                     | —                          |
| `JWT_REFRESH_SECRET`   | Secreto del refresh token                    | —                          |
| `JWT_ACCESS_EXPIRY`    | Expiración del access token                  | `15m`                      |
| `JWT_REFRESH_EXPIRY`   | Expiración del refresh token                 | `7d`                       |
| `CORS_ORIGIN`          | Origen permitido (CORS)                      | `http://localhost:4200`    |
| `SYSTEM_INGEST_KEY`    | Llave para ingesta de lecturas del gateway   | `local-dev-ingest-key`     |
| `KPI_CACHE_TTL_SECONDS`| TTL de la caché de KPIs                       | `10`                       |

### IoT Gateway

| Variable               | Descripción                                  | Default          |
|------------------------|----------------------------------------------|------------------|
| `MQTT_MODE`            | `local` (HTTP) o `aws` (MQTT a IoT Core)     | `local`          |
| `BACKEND_URL`          | URL del backend (modo local)                 | `http://backend:3000` |
| `PUBLISH_INTERVAL_MS`  | Intervalo entre publicaciones                | `5000`           |
| `ACTIVE_DEVICES`       | Cantidad de dispositivos a simular           | `10`             |
| `ANOMALY_PROBABILITY`  | Probabilidad de lectura fuera de umbral      | `0.05`           |
| `MQTT_TOPIC_PREFIX`    | Prefijo del topic MQTT                       | `dt/devices`     |
| `SYSTEM_INGEST_KEY`    | Llave de ingesta (debe coincidir con backend)| `local-dev-ingest-key` |
| `IOT_ENDPOINT`         | Endpoint de AWS IoT Core (modo aws)          | —                |
| `CERT_PATH`            | Ruta a certificados X.509 (modo aws)         | `./certs/`       |

---

## 👤 Usuarios por defecto

Tras ejecutar `npm run db:seed`:

| Email                 | Password     | Rol   |
|-----------------------|--------------|-------|
| `admin@salinas.local` | `Admin1234!` | admin |

> Con el admin puedes registrar más usuarios (operator / viewer) vía `POST /api/v1/auth/register`.

---

## 📡 Endpoints de la API

Base URL: `http://localhost:3000/api/v1`

### Autenticación
| Método | Endpoint            | Roles         |
|--------|---------------------|---------------|
| POST   | `/auth/register`    | admin         |
| POST   | `/auth/login`       | público       |
| POST   | `/auth/refresh`     | autenticado   |
| POST   | `/auth/logout`      | autenticado   |
| GET    | `/auth/me`          | autenticado   |

### Dispositivos
| Método | Endpoint                  | Roles            |
|--------|---------------------------|------------------|
| GET    | `/devices`                | todos            |
| GET    | `/devices/:id`            | todos            |
| POST   | `/devices`                | admin, operator  |
| PUT    | `/devices/:id`            | admin, operator  |
| PATCH  | `/devices/:id/status`     | admin, operator  |
| DELETE | `/devices/:id`            | admin            |
| GET    | `/devices/:id/readings`   | todos            |
| GET    | `/devices/:id/alerts`     | todos            |
| GET    | `/devices/stats/summary`  | todos            |

### Lecturas
| Método | Endpoint               | Roles    |
|--------|------------------------|----------|
| GET    | `/readings`            | todos    |
| POST   | `/readings/batch`      | sistema  |
| GET    | `/readings/analytics`  | todos    |

### Alertas
| Método | Endpoint                   | Roles            |
|--------|----------------------------|------------------|
| GET    | `/alerts`                  | todos            |
| PATCH  | `/alerts/:id/acknowledge`  | admin, operator  |
| PATCH  | `/alerts/:id/resolve`      | admin, operator  |

### Dashboard
| Método | Endpoint                   | Roles  |
|--------|----------------------------|--------|
| GET    | `/dashboard/overview`      | todos  |
| GET    | `/dashboard/rack/:rackId`  | todos  |
| GET    | `/dashboard/trends`        | todos  |

---

## 📚 Documentación Swagger / Postman

- **Swagger UI:** http://localhost:3000/docs (especificación en `/docs.json`)
- **Colección Postman:** [`docs/postman/salinas-iot-platform.postman_collection.json`](docs/postman/salinas-iot-platform.postman_collection.json)

Importa la colección en Postman, ejecuta primero el request de **Login** (guarda el token automáticamente
en la variable `accessToken`) y luego el resto de los endpoints.

---

## 🔌 WebSocket (tiempo real)

Conexión: `ws://localhost:3001`

**Servidor → Cliente:** `device:reading`, `device:status`, `alert:new`, `alert:resolved`, `dashboard:update`
**Cliente → Servidor:** `subscribe:device`, `subscribe:rack`, `unsubscribe:device`, `acknowledge:alert`

---

## 🛰 IoT Gateway / Simulador

Demonio Node.js que simula dispositivos IoT publicando lecturas realistas cada 5–10 s:

- **temperature:** 18–45 °C (crítico > 35 °C)
- **humidity:** 20–80 % (crítico > 70 %)
- **power:** 0–100 kW
- **ups:** carga 0–100 %
- **cooling:** flujo en L/min

Simula **anomalías** (probabilidad configurable, 5% por defecto) y **cambios de estado** (online → offline)
con baja frecuencia. Se reconecta automáticamente. Incluido como servicio en `docker-compose`.

---

## 📁 Estructura del proyecto

```
salinas-iot-platform/
├── backend/              # API REST + WebSocket (Node.js / Express / TS)
│   └── src/
│       ├── routes/       # Definición de endpoints
│       ├── services/     # Lógica de negocio (devices, readings, alerts, auth...)
│       ├── middleware/   # auth, rate-limit, validación, sanitización, errores
│       ├── db/           # Cliente DynamoDB, init de tabla, seed de usuarios
│       └── utils/        # logger, paginación, errores
├── iot-gateway/          # Simulador de dispositivos (demonio)
├── frontend/             # Aplicación Angular (en construcción)
├── infrastructure/       # IaC con AWS CDK (diseño)
├── docs/
│   ├── postman/          # Colección Postman
│   └── architecture/     # Diagrama de arquitectura
└── docker-compose.yml    # Orquestación local
```

---

## ☁️ Despliegue en AWS (diseño)

Arquitectura objetivo en producción:

1. **IoT Gateway** en EC2 (servicio systemd) o ECS publicando por MQTT/TLS a **AWS IoT Core**.
2. **IoT Rule** que invoca una **Lambda** (o reenvía por HTTP) con la lógica de ingesta del backend.
3. **DynamoDB** con single-table design, GSI1 y TTL.
4. **API Gateway** (REST + WebSocket) frente al backend.
5. **S3 + CloudFront** sirviendo el frontend Angular.

El directorio [`infrastructure/`](infrastructure/) contiene el proyecto **AWS CDK** para aprovisionar
estos recursos. *(En progreso.)*

---

## 🎥 Video explicativo

> 📺 **Enlace al video:** _(pendiente — se agregará aquí)_

El video recorre: arquitectura y decisiones de diseño, el IoT Gateway en ejecución, el backend
(estructura, endpoints, JWT, WebSockets, manejo de alertas), la infraestructura y una demo
end-to-end en vivo.

---

## 📝 Licencia

MIT
