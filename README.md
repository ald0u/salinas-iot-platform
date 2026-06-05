# Salinas IoT Platform

Sistema de monitoreo en tiempo real para los dispositivos IoT de un centro de datos: sensores de
temperatura, humedad, consumo eléctrico, estado de UPS y equipos de enfriamiento.

La plataforma permite ver el estado de los dispositivos al momento, generar alertas cuando un valor
se sale de su umbral, consultar históricos y tendencias, administrar los dispositivos (alta, baja y
edición) y manejar usuarios con tres roles: admin, operator y viewer.

Desarrollado como prueba técnica para Grupo Salinas DC.


## Demo en vivo

La plataforma está desplegada y accesible públicamente:

- **Frontend:** https://salinas-iot-frontend.ylbuuv.easypanel.host
- **API / Swagger:** https://salinas-iot-backend.ylbuuv.easypanel.host/docs

Usuario de prueba: `admin@salinas.local` / `Admin1234!`

Está corriendo en un servidor con EasyPanel (Docker), con los servicios separados: frontend (nginx),
backend, broker MQTT (Mosquitto) y DynamoDB Local.


## Cómo está construido

El camino que siguen los datos es este:

```
IoT Gateway (Node.js)
   simula los sensores y publica sus lecturas
        │  MQTT  →  topic dt/devices/{deviceId}/telemetry
        ▼
Mosquitto  (broker MQTT — equivale a AWS IoT Core)
        │
        ▼
Backend (Express + Socket.io)
   1. guarda la lectura en DynamoDB
   2. compara contra los umbrales del dispositivo y, si hace falta, crea una alerta
   3. avisa a los clientes conectados por WebSocket
        │
        ├──────────────► DynamoDB (single-table)
        │
        └──────────────► Frontend Angular (dashboards en tiempo real)
```

En resumen, cada pieza hace lo siguiente:

- **IoT Gateway**: un proceso de Node.js que corre en segundo plano, simula los dispositivos y
  publica sus lecturas por MQTT cada 5–10 segundos.
- **Mosquitto**: el broker MQTT que recibe la telemetría. En la nube este papel lo haría AWS IoT Core.
- **Backend**: recibe cada lectura, la persiste, evalúa los umbrales, genera alertas y emite eventos
  en tiempo real. Expone además la API REST y la autenticación.
- **DynamoDB**: la base de datos. En local se usa DynamoDB Local.
- **Frontend**: una aplicación de Angular con seis pantallas (login, dashboard, dispositivos, detalle,
  alertas y analytics). Consume la API REST y se suscribe al WebSocket, así que las gráficas y las
  alertas se actualizan solas. Usa Angular Material, gráficas con Chart.js, tema claro/oscuro y carga
  perezosa de cada módulo.


## Una nota sobre AWS

La solución está pensada para desplegarse en AWS (IoT Core, DynamoDB, Lambda, API Gateway y
S3 + CloudFront). Como no quise depender de una cuenta de AWS con costos para desarrollarla y
demostrarla, la dejé corriendo entera en local con piezas equivalentes: Mosquitto en lugar de
IoT Core, DynamoDB Local en lugar de DynamoDB, y el backend de Node haciendo el trabajo que en AWS
harían una Lambda y el API Gateway.

Lo importante es que no está amarrada a esos equivalentes: el gateway publica por MQTT a un broker
local o a AWS IoT Core (con `mqtts://` y certificados X.509) cambiando solo variables de entorno, sin
tocar el código.

Para los datos elegí **single-table design** en DynamoDB: una sola tabla con un índice secundario
(GSI1) y TTL. De esa forma escala sin administrar servidores y las lecturas viejas se eliminan solas
a los 30 días, sin tener que correr tareas de limpieza.


## Requisitos

- Docker y Docker Compose.
- Node.js 18 o superior (solo si quieres correrlo sin Docker).


## Cómo levantarlo

Con Docker es de un solo comando:

```bash
git clone <url-del-repo>
cd salinas-iot-platform
docker compose up --build
```

Eso levanta la base de datos, el broker, el backend y el gateway. El backend además crea la tabla y
el usuario administrador automáticamente al arrancar, así que no hay que correr pasos manuales.

Cuando termine de subir, esto es lo que queda disponible:

| Servicio        | Dirección                      |
|-----------------|--------------------------------|
| API REST        | http://localhost:3000/api/v1   |
| WebSocket       | ws://localhost:3000            |
| Swagger         | http://localhost:3000/docs     |
| Broker MQTT     | mqtt://localhost:1883          |
| DynamoDB Local  | http://localhost:8000          |
| DynamoDB Admin  | http://localhost:8001          |

> El WebSocket usa Socket.io y comparte el mismo servidor del backend (puerto 3000).

### Sin Docker

Necesitas DynamoDB Local corriendo en `http://localhost:8000` y un broker MQTT en `localhost:1883`.

```bash
cd backend
npm install
npm run build
npm run db:init    # crea la tabla
npm run db:seed    # crea el usuario admin
npm run start

# en otra terminal
cd iot-gateway
npm install
npm run dev
```

### El frontend

El frontend corre aparte (no va dentro del docker-compose). Con el backend ya arriba:

```bash
cd frontend
npm install
npm start
```

Queda en `http://localhost:4200`. Entra con el usuario de abajo y verás el dashboard con los datos
del simulador actualizándose en vivo. El frontend apunta al backend en `http://localhost:3000`
(configurable en `src/environments/environment.ts`).


## Usuario inicial

Después de sembrar la base de datos queda creado un administrador:

- **Email:** `admin@salinas.local`
- **Password:** `Admin1234!`

Con ese usuario puedes dar de alta a otros (operator o viewer) desde `POST /api/v1/auth/register`.


## La API

Base: `http://localhost:3000/api/v1`. Documentación interactiva en `/docs` (Swagger) y colección
lista para importar en [docs/postman](docs/postman/salinas-iot-platform.postman_collection.json).

**Autenticación**

| Método | Ruta             | Quién                |
|--------|------------------|----------------------|
| POST   | `/auth/register` | admin                |
| POST   | `/auth/login`    | público              |
| POST   | `/auth/refresh`  | autenticado          |
| POST   | `/auth/logout`   | autenticado          |
| GET    | `/auth/me`       | autenticado          |

**Dispositivos**

| Método | Ruta                     | Quién            |
|--------|--------------------------|------------------|
| GET    | `/devices`               | todos            |
| GET    | `/devices/:id`           | todos            |
| POST   | `/devices`               | admin, operator  |
| PUT    | `/devices/:id`           | admin, operator  |
| PATCH  | `/devices/:id/status`    | admin, operator  |
| DELETE | `/devices/:id`           | admin            |
| GET    | `/devices/:id/readings`  | todos            |
| GET    | `/devices/:id/alerts`    | todos            |
| GET    | `/devices/stats/summary` | todos            |

**Lecturas**

| Método | Ruta                  | Quién    |
|--------|-----------------------|----------|
| GET    | `/readings`           | todos    |
| POST   | `/readings/batch`     | sistema  |
| GET    | `/readings/analytics` | todos    |

**Alertas**

| Método | Ruta                      | Quién            |
|--------|---------------------------|------------------|
| GET    | `/alerts`                 | todos            |
| PATCH  | `/alerts/:id/acknowledge` | admin, operator  |
| PATCH  | `/alerts/:id/resolve`     | admin, operator  |

**Dashboard**

| Método | Ruta                      | Quién  |
|--------|---------------------------|--------|
| GET    | `/dashboard/overview`     | todos  |
| GET    | `/dashboard/rack/:rackId` | todos  |
| GET    | `/dashboard/trends`       | todos  |


## Eventos de WebSocket

El servidor envía: `device:reading`, `device:status`, `alert:new`, `alert:resolved`,
`dashboard:update`.

El cliente puede mandar: `subscribe:device`, `subscribe:rack`, `unsubscribe:device`,
`unsubscribe:rack`, `acknowledge:alert`.


## Variables de entorno

**Backend**

| Variable               | Para qué sirve                               | Por defecto              |
|------------------------|----------------------------------------------|--------------------------|
| `PORT`                 | Puerto del backend (REST y WebSocket)        | `3000`                   |
| `DYNAMODB_ENDPOINT`    | Endpoint de DynamoDB                         | `http://localhost:8000`  |
| `DYNAMODB_TABLE`       | Nombre de la tabla                           | `IoTData`                |
| `JWT_ACCESS_SECRET`    | Secreto del access token                     | —                        |
| `JWT_REFRESH_SECRET`   | Secreto del refresh token                    | —                        |
| `JWT_ACCESS_EXPIRY`    | Vida del access token                        | `15m`                    |
| `JWT_REFRESH_EXPIRY`   | Vida del refresh token                       | `7d`                     |
| `CORS_ORIGIN`          | Origen permitido                             | `http://localhost:4200`  |
| `SYSTEM_INGEST_KEY`    | Llave para la ingesta del gateway por HTTP   | `local-dev-ingest-key`   |
| `MQTT_ENABLED`         | Activa el suscriptor MQTT del backend        | `false`                  |
| `MQTT_BROKER_URL`      | URL del broker MQTT                          | `mqtt://localhost:1883`  |
| `MQTT_TOPIC_PREFIX`    | Prefijo del topic a escuchar                 | `dt/devices`             |

**IoT Gateway**

| Variable               | Para qué sirve                               | Por defecto             |
|------------------------|----------------------------------------------|-------------------------|
| `MQTT_MODE`            | `aws` (publica por MQTT) o `local` (por HTTP)| `local`                 |
| `IOT_ENDPOINT`         | Broker MQTT al que publica                   | `mqtt://localhost:1883` |
| `CERT_PATH`            | Certificados X.509 (solo para AWS real)      | `./certs/`              |
| `BACKEND_URL`          | URL del backend (modo HTTP)                  | `http://backend:3000`   |
| `PUBLISH_INTERVAL_MS`  | Cada cuánto publica                          | `5000`                  |
| `ACTIVE_DEVICES`       | Cuántos dispositivos simula                  | `10`                    |
| `ANOMALY_PROBABILITY`  | Probabilidad de una lectura fuera de umbral  | `0.05`                  |
| `MQTT_TOPIC_PREFIX`    | Prefijo del topic                            | `dt/devices`            |


## Estructura del proyecto

```
salinas-iot-platform/
├── backend/                     API REST + WebSocket + suscriptor MQTT (Express / TS)
│   ├── src/
│   │   ├── config/              env.ts — configuración por variables de entorno
│   │   ├── db/                  cliente DynamoDB, creación de tabla y seed del admin
│   │   ├── middleware/          auth, rate-limit, validación, sanitización, errores
│   │   ├── routes/              auth, devices, readings, alerts, dashboard
│   │   ├── services/            auth, device, reading, alert, dashboard, socket, token, mqtt, maintenance
│   │   ├── types/               tipos del dominio
│   │   ├── utils/               logger, errores, paginación
│   │   ├── app.ts               configuración de Express
│   │   ├── server.ts            arranque: HTTP + WebSocket + MQTT + limpieza automática
│   │   └── swagger.ts           documentación OpenAPI
│   ├── Dockerfile               imagen de producción
│   ├── Dockerfile.dev
│   └── package.json
├── iot-gateway/                 simulador de dispositivos (demonio Node.js)
│   ├── src/index.ts
│   ├── Dockerfile               imagen de producción
│   └── Dockerfile.dev
├── frontend/                    aplicación Angular (6 pantallas, tiempo real)
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/            servicios, interceptor JWT, guards, directiva hasRole, modelos
│   │   │   ├── features/        login, dashboard, devices, device-detail, alerts, analytics
│   │   │   ├── layout/          shell (toolbar, sidenav, tema claro/oscuro)
│   │   │   └── shared/          componente de gráficas (Chart.js)
│   │   └── environments/        configuración (URL del backend por entorno)
│   ├── Dockerfile               build de Angular + nginx
│   └── nginx.conf
├── infrastructure/              IaC con AWS CDK (DynamoDB, IoT Core, Lambda, API GW, S3+CloudFront)
├── mosquitto/
│   └── mosquitto.conf           configuración del broker MQTT
├── docs/
│   ├── architecture/            diagramas y decisiones de diseño
│   └── postman/                 colección de la API
└── docker-compose.yml           orquesta todo en local
```


## Si se quisiera llevar a AWS

El diseño en la nube sería: el gateway en EC2 o ECS publicando por MQTT a AWS IoT Core; una IoT Rule
que dispara una Lambda (o reenvía por HTTP) con la lógica de ingesta del backend; DynamoDB con TTL;
API Gateway al frente; y el frontend en S3 + CloudFront. Esos recursos están descritos como código en
el directorio [`infrastructure/`](infrastructure/) con AWS CDK; `npm run synth` genera la plantilla de
CloudFormation sin necesidad de una cuenta de AWS.


## Video

Video explicativo de la solución (arquitectura, gateway, backend, frontend, infraestructura y demo
end-to-end):

**https://drive.google.com/file/d/1lMmQkZklHOsZXGJalWDa6PP-QSHqvjtQ/view?usp=drive_link**
