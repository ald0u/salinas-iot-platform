# Diagrama de Arquitectura — Salinas IoT Platform

> Los diagramas están en **Mermaid**, que GitHub renderiza automáticamente.
> Para exportar a imagen: pega el código en <https://mermaid.live> y descarga PNG/SVG.

## 1. Vista general (flujo de telemetría dual-mode)

```mermaid
flowchart TB
    subgraph GW["IoT Gateway · demonio Node.js (Docker / EC2)"]
        SIM["Simuladores de sensores<br/>Temp · Humedad · Power · UPS · Cooling"]
        PUB["MQTT Publisher (dual-mode)"]
        SIM --> PUB
    end

    PUB -- "MQTT_MODE=local (DEMO)<br/>HTTP POST /api/v1/readings/batch" --> BE
    PUB -. "MQTT_MODE=aws (diseño)<br/>MQTT/TLS · dt/devices/{id}/telemetry" .-> IOT["AWS IoT Core<br/>(IoT Rule)"]
    IOT -. "invoca / reenvía" .-> BE

    subgraph BE["Backend · Node.js + Express (Lambda o EC2 en AWS)"]
        ING["Ingesta de lecturas"]
        TH["Evaluación de umbrales<br/>→ genera alertas"]
        API["REST API /api/v1<br/>JWT + RBAC"]
        WS["WebSocket · Socket.io"]
        ING --> TH --> WS
    end

    BE --> DB[("DynamoDB<br/>single-table · GSI1 · TTL<br/>local: DynamoDB Local")]
    API --> DB
    WS -- "device:reading · device:status<br/>alert:new · alert:resolved · dashboard:update" --> FE
    API -- "REST (CRUD, auth, dashboard)" --> FE["Frontend Angular<br/>local: dev server · cloud: S3 + CloudFront"]
```

## 2. Modelo de datos (single-table design)

```mermaid
erDiagram
    DEVICE {
        string PK "DEVICE#<id>"
        string SK "METADATA"
        string type "temperature|humidity|power|ups|cooling"
        string status "online|offline|maintenance|critical"
        object thresholds "min/max/criticalMin/criticalMax"
    }
    READING {
        string PK "DEVICE#<id>"
        string SK "READING#<timestamp>#<uuid>"
        number value
        string quality "good|uncertain|bad"
        number TTL "epoch + 30 días"
    }
    ALERT {
        string PK "ALERT#<id>"
        string SK "METADATA"
        string GSI1PK "DEVICE#<id>"
        string severity "info|warning|critical|emergency"
        boolean acknowledged
    }
    USER {
        string PK "USER#<id>"
        string SK "METADATA"
        string GSI1PK "EMAIL#<email>"
        string role "admin|operator|viewer"
    }
    REFRESH_TOKEN {
        string PK "USER#<id>"
        string SK "REFRESH#<tokenId>"
        number TTL "epoch + 7 días"
    }

    DEVICE ||--o{ READING : "tiene"
    DEVICE ||--o{ ALERT : "genera (vía GSI1)"
    USER ||--o{ REFRESH_TOKEN : "posee"
```

- **Una sola tabla** (`IoTData`) para todas las entidades.
- **GSI1** (`GSI1PK` + `SK`) → busca usuarios por email y alertas por dispositivo.
- **TTL** → borra automáticamente lecturas (30 d) y refresh tokens (7 d).

## 3. Flujo de una lectura anómala (end-to-end)

```mermaid
sequenceDiagram
    participant G as IoT Gateway
    participant B as Backend
    participant D as DynamoDB
    participant C as Cliente (WebSocket)

    G->>B: POST /readings/batch (value fuera de umbral)
    B->>D: Persiste READING (con TTL)
    B->>B: Evalúa thresholds → severity = critical
    B->>D: Crea ALERT (threshold_exceeded)
    B-->>C: emit device:reading
    B-->>C: emit alert:new
    B-->>C: emit dashboard:update
    Note over C: El dashboard se actualiza en tiempo real
```

## 4. Despliegue objetivo en AWS

```mermaid
flowchart LR
    EC2["EC2 / ECS<br/>IoT Gateway"] -->|MQTT/TLS| IOT["AWS IoT Core"]
    IOT -->|IoT Rule| LAM["Lambda / EC2<br/>Backend"]
    LAM --> DDB[("DynamoDB")]
    LAM --> APIGW["API Gateway<br/>REST + WebSocket"]
    APIGW --> CF["CloudFront"]
    S3["S3 (Angular build)"] --> CF
    CF --> USER["Usuario"]
```
