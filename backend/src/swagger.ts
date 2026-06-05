import type { Express } from "express";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const bearer = [{ bearerAuth: [] }];

/** Respuesta JSON que referencia un schema. */
function jsonRef(ref: string, description: string) {
  return {
    description,
    content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
  };
}

/** Body JSON requerido que referencia un schema. */
function jsonBody(ref: string) {
  return {
    required: true,
    content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
  };
}

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
  description: "Identificador del recurso",
};

/** Respuestas de error reutilizables (referencian #/components/responses). */
const r400 = { 400: { $ref: "#/components/responses/BadRequest" } };
const r401 = { 401: { $ref: "#/components/responses/Unauthorized" } };
const r403 = { 403: { $ref: "#/components/responses/Forbidden" } };
const r404 = { 404: { $ref: "#/components/responses/NotFound" } };

const spec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Salinas IoT Platform API",
      version: "1.0.0",
      description:
        "API para el monitoreo de dispositivos IoT de un centro de datos en tiempo real. " +
        "Autenticación con JWT (Bearer). Usuario de prueba: admin@salinas.local / Admin1234!",
    },
    tags: [
      { name: "Auth", description: "Autenticación y usuarios" },
      { name: "Dispositivos", description: "Gestión de dispositivos" },
      { name: "Lecturas", description: "Ingesta y consulta de lecturas" },
      { name: "Alertas", description: "Gestión de alertas" },
      { name: "Dashboard", description: "KPIs, racks y tendencias" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        AuthTokens: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
          },
          example: {
            accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
        },
        UserSafe: {
          type: "object",
          properties: {
            userId: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["admin", "operator", "viewer"] },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
          example: {
            userId: "9f1c2a4b-1234-4abc-9def-0123456789ab",
            email: "admin@salinas.local",
            role: "admin",
            isActive: true,
            createdAt: "2026-06-01T10:00:00.000Z",
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/UserSafe" },
            tokens: { $ref: "#/components/schemas/AuthTokens" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
          example: { email: "admin@salinas.local", password: "Admin1234!" },
        },
        RegisterRequest: {
          type: "object",
          required: ["email", "password", "role"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            role: { type: "string", enum: ["admin", "operator", "viewer"] },
          },
          example: { email: "operator@salinas.local", password: "Operator1234!", role: "operator" },
        },
        RefreshRequest: {
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } },
          example: { refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
        },
        DeviceInput: {
          type: "object",
          required: ["name", "type", "location", "status", "thresholds", "metadata"],
          properties: {
            name: { type: "string" },
            type: { type: "string", enum: ["temperature", "humidity", "power", "ups", "cooling"] },
            location: {
              type: "object",
              properties: {
                rack: { type: "string" },
                position: { type: "integer", minimum: 1 },
                floor: { type: "integer", minimum: 1 },
              },
            },
            status: { type: "string", enum: ["online", "offline", "maintenance", "critical"] },
            thresholds: {
              type: "object",
              properties: {
                min: { type: "number" },
                max: { type: "number" },
                criticalMin: { type: "number" },
                criticalMax: { type: "number" },
              },
            },
            metadata: {
              type: "object",
              properties: {
                manufacturer: { type: "string" },
                model: { type: "string" },
                firmwareVersion: { type: "string" },
              },
            },
          },
          example: {
            name: "Rack Temp Sensor 01",
            type: "temperature",
            location: { rack: "A1", position: 1, floor: 1 },
            status: "online",
            thresholds: { min: 18, max: 30, criticalMin: 15, criticalMax: 35 },
            metadata: { manufacturer: "ACME", model: "TMP-100", firmwareVersion: "1.0.0" },
          },
        },
        DeviceStatusInput: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["online", "offline", "maintenance", "critical"] },
          },
          example: { status: "maintenance" },
        },
        Device: {
          type: "object",
          properties: {
            deviceId: { type: "string", format: "uuid" },
            name: { type: "string" },
            type: { type: "string", enum: ["temperature", "humidity", "power", "ups", "cooling"] },
            location: {
              type: "object",
              properties: {
                rack: { type: "string" },
                position: { type: "integer" },
                floor: { type: "integer" },
              },
            },
            status: { type: "string", enum: ["online", "offline", "maintenance", "critical"] },
            thresholds: {
              type: "object",
              properties: {
                min: { type: "number" },
                max: { type: "number" },
                criticalMin: { type: "number" },
                criticalMax: { type: "number" },
              },
            },
            metadata: {
              type: "object",
              properties: {
                manufacturer: { type: "string" },
                model: { type: "string" },
                firmwareVersion: { type: "string" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          example: {
            deviceId: "b3f1c2a4-1234-4abc-9def-0123456789ab",
            name: "Rack Temp Sensor 01",
            type: "temperature",
            location: { rack: "A1", position: 1, floor: 1 },
            status: "online",
            thresholds: { min: 18, max: 30, criticalMin: 15, criticalMax: 35 },
            metadata: { manufacturer: "ACME", model: "TMP-100", firmwareVersion: "1.0.0" },
            createdAt: "2026-06-01T10:00:00.000Z",
            updatedAt: "2026-06-01T10:00:00.000Z",
          },
        },
        DevicesPage: {
          type: "object",
          properties: {
            items: { type: "array", items: { $ref: "#/components/schemas/Device" } },
            nextCursor: { type: "string", nullable: true },
          },
        },
        DeviceStats: {
          type: "object",
          properties: {
            total: { type: "integer" },
            online: { type: "integer" },
            offline: { type: "integer" },
            maintenance: { type: "integer" },
            critical: { type: "integer" },
          },
          example: { total: 10, online: 8, offline: 1, maintenance: 1, critical: 0 },
        },
        Reading: {
          type: "object",
          properties: {
            deviceId: { type: "string" },
            value: { type: "number" },
            unit: { type: "string" },
            quality: { type: "string", enum: ["good", "uncertain", "bad"] },
            timestamp: { type: "string", format: "date-time" },
          },
          example: {
            deviceId: "b3f1c2a4-1234-4abc-9def-0123456789ab",
            value: 23.5,
            unit: "°C",
            quality: "good",
            timestamp: "2026-06-03T12:00:00.000Z",
          },
        },
        ReadingsPage: {
          type: "object",
          properties: {
            items: { type: "array", items: { $ref: "#/components/schemas/Reading" } },
            nextCursor: { type: "string", nullable: true },
          },
        },
        BatchReadings: {
          type: "object",
          required: ["readings"],
          properties: {
            readings: { type: "array", items: { $ref: "#/components/schemas/Reading" } },
          },
          example: {
            readings: [
              {
                deviceId: "b3f1c2a4-1234-4abc-9def-0123456789ab",
                value: 23.5,
                unit: "°C",
                quality: "good",
                timestamp: "2026-06-03T12:00:00.000Z",
              },
            ],
          },
        },
        BatchResult: {
          type: "object",
          properties: { inserted: { type: "integer" } },
          example: { inserted: 1 },
        },
        ReadingsAnalytics: {
          type: "object",
          properties: {
            total: { type: "integer" },
            average: { type: "number" },
            min: { type: "number" },
            max: { type: "number" },
          },
          example: { total: 1500, average: 24.3, min: 15.1, max: 41.8 },
        },
        Alert: {
          type: "object",
          properties: {
            alertId: { type: "string", format: "uuid" },
            deviceId: { type: "string" },
            severity: { type: "string", enum: ["info", "warning", "critical", "emergency"] },
            type: { type: "string", enum: ["threshold_exceeded", "device_offline", "anomaly_detected"] },
            message: { type: "string" },
            acknowledged: { type: "boolean" },
            resolvedAt: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
          example: {
            alertId: "a1b2c3d4-5678-4abc-9def-0123456789ab",
            deviceId: "b3f1c2a4-1234-4abc-9def-0123456789ab",
            severity: "critical",
            type: "threshold_exceeded",
            message: "Valor crítico para humidity-07: 94.9%",
            acknowledged: false,
            resolvedAt: null,
            createdAt: "2026-06-03T12:00:05.000Z",
          },
        },
        AlertsPage: {
          type: "object",
          properties: {
            items: { type: "array", items: { $ref: "#/components/schemas/Alert" } },
            nextCursor: { type: "string", nullable: true },
          },
        },
        DashboardOverview: {
          type: "object",
          properties: {
            generatedAt: { type: "string", format: "date-time" },
            devices: { type: "object" },
            alerts: { type: "object" },
            readings: { type: "object" },
          },
          example: {
            generatedAt: "2026-06-03T12:00:00.000Z",
            devices: { total: 10, online: 8, critical: 0 },
            alerts: { total: 35, active: 12, acknowledged: 5 },
            readings: { total: 500 },
          },
        },
        RackOverview: {
          type: "object",
          properties: {
            rackId: { type: "string" },
            totalDevices: { type: "integer" },
            byStatus: { type: "object" },
          },
          example: { rackId: "A1", totalDevices: 3, byStatus: { online: 2, critical: 1 } },
        },
        Trends: {
          type: "object",
          properties: {
            hours: { type: "integer" },
            points: { type: "integer" },
            byDevice: { type: "object" },
          },
          example: {
            hours: 24,
            points: 736,
            byDevice: {
              "b3f1c2a4-1234-4abc-9def-0123456789ab": { count: 120, avg: 24.5, sum: 2940 },
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: { message: { type: "string" }, code: { type: "string" } },
            },
          },
          example: { error: { message: "Recurso no encontrado", code: "NOT_FOUND" } },
        },
      },
      responses: {
        BadRequest: jsonRef("Error", "Datos inválidos (validación)"),
        Unauthorized: jsonRef("Error", "Token faltante o inválido"),
        Forbidden: jsonRef("Error", "Sin permisos para esta acción"),
        NotFound: jsonRef("Error", "Recurso no encontrado"),
      },
    },
    security: bearer,
    paths: {
      "/health": {
        get: { tags: ["Auth"], summary: "Health check", security: [], responses: { 200: { description: "OK" } } },
      },

      "/api/v1/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Registrar usuario (solo admin)",
          security: bearer,
          requestBody: jsonBody("RegisterRequest"),
          responses: {
            201: jsonRef("AuthResponse", "Usuario creado"),
            ...r400,
            ...r401,
            ...r403,
            409: jsonRef("Error", "El email ya está registrado"),
          },
        },
      },
      "/api/v1/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login (público)",
          security: [],
          requestBody: jsonBody("LoginRequest"),
          responses: {
            200: jsonRef("AuthResponse", "Tokens y usuario"),
            ...r400,
            401: jsonRef("Error", "Credenciales inválidas"),
          },
        },
      },
      "/api/v1/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Rotar tokens",
          security: bearer,
          requestBody: jsonBody("RefreshRequest"),
          responses: { 200: jsonRef("AuthTokens", "Nuevos tokens"), ...r400, ...r401 },
        },
      },
      "/api/v1/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Cerrar sesión (revoca el refresh token)",
          security: bearer,
          requestBody: jsonBody("RefreshRequest"),
          responses: { 204: { description: "Sesión cerrada" }, ...r400, ...r401 },
        },
      },
      "/api/v1/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Usuario actual",
          security: bearer,
          responses: {
            200: {
              description: "Usuario autenticado",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { user: { $ref: "#/components/schemas/UserSafe" } } },
                },
              },
            },
            ...r401,
          },
        },
      },

      "/api/v1/devices": {
        get: {
          tags: ["Dispositivos"],
          summary: "Listar dispositivos (paginación cursor)",
          security: bearer,
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: { 200: jsonRef("DevicesPage", "Página de dispositivos"), ...r401 },
        },
        post: {
          tags: ["Dispositivos"],
          summary: "Crear dispositivo (admin, operator)",
          security: bearer,
          requestBody: jsonBody("DeviceInput"),
          responses: { 201: jsonRef("Device", "Dispositivo creado"), ...r400, ...r401, ...r403 },
        },
      },
      "/api/v1/devices/stats/summary": {
        get: {
          tags: ["Dispositivos"],
          summary: "Resumen por estado",
          security: bearer,
          responses: { 200: jsonRef("DeviceStats", "Conteo por estado"), ...r401 },
        },
      },
      "/api/v1/devices/{id}": {
        get: {
          tags: ["Dispositivos"],
          summary: "Obtener dispositivo",
          security: bearer,
          parameters: [idParam],
          responses: { 200: jsonRef("Device", "Dispositivo"), ...r401, ...r404 },
        },
        put: {
          tags: ["Dispositivos"],
          summary: "Actualizar dispositivo (admin, operator)",
          security: bearer,
          parameters: [idParam],
          requestBody: jsonBody("DeviceInput"),
          responses: { 200: jsonRef("Device", "Dispositivo actualizado"), ...r400, ...r401, ...r403, ...r404 },
        },
        delete: {
          tags: ["Dispositivos"],
          summary: "Eliminar dispositivo (admin)",
          security: bearer,
          parameters: [idParam],
          responses: { 204: { description: "Eliminado" }, ...r401, ...r403, ...r404 },
        },
      },
      "/api/v1/devices/{id}/status": {
        patch: {
          tags: ["Dispositivos"],
          summary: "Cambiar estado (admin, operator)",
          security: bearer,
          parameters: [idParam],
          requestBody: jsonBody("DeviceStatusInput"),
          responses: { 200: jsonRef("Device", "Estado actualizado"), ...r400, ...r401, ...r403, ...r404 },
        },
      },
      "/api/v1/devices/{id}/readings": {
        get: {
          tags: ["Dispositivos"],
          summary: "Lecturas del dispositivo",
          security: bearer,
          parameters: [idParam, { name: "limit", in: "query", schema: { type: "integer", default: 50 } }],
          responses: { 200: jsonRef("ReadingsPage", "Lecturas"), ...r401 },
        },
      },
      "/api/v1/devices/{id}/alerts": {
        get: {
          tags: ["Dispositivos"],
          summary: "Alertas del dispositivo",
          security: bearer,
          parameters: [idParam],
          responses: { 200: jsonRef("AlertsPage", "Alertas"), ...r401 },
        },
      },

      "/api/v1/readings": {
        get: {
          tags: ["Lecturas"],
          summary: "Listar lecturas (paginación cursor)",
          security: bearer,
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 100 } },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: { 200: jsonRef("ReadingsPage", "Página de lecturas"), ...r401 },
        },
      },
      "/api/v1/readings/batch": {
        post: {
          tags: ["Lecturas"],
          summary: "Ingesta por lote (sistema: header x-system-key o token)",
          requestBody: jsonBody("BatchReadings"),
          responses: {
            202: jsonRef("BatchResult", "Aceptado"),
            ...r400,
            401: jsonRef("Error", "No autorizado para ingestar"),
          },
        },
      },
      "/api/v1/readings/analytics": {
        get: {
          tags: ["Lecturas"],
          summary: "Agregados (total, promedio, min, max)",
          security: bearer,
          parameters: [{ name: "deviceId", in: "query", schema: { type: "string" } }],
          responses: { 200: jsonRef("ReadingsAnalytics", "Analíticas"), ...r401 },
        },
      },

      "/api/v1/alerts": {
        get: {
          tags: ["Alertas"],
          summary: "Listar alertas (paginación cursor)",
          security: bearer,
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 100 } },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: { 200: jsonRef("AlertsPage", "Página de alertas"), ...r401 },
        },
      },
      "/api/v1/alerts/{id}/acknowledge": {
        patch: {
          tags: ["Alertas"],
          summary: "Reconocer alerta (admin, operator)",
          security: bearer,
          parameters: [idParam],
          responses: { 200: jsonRef("Alert", "Alerta reconocida"), ...r401, ...r403, ...r404 },
        },
      },
      "/api/v1/alerts/{id}/resolve": {
        patch: {
          tags: ["Alertas"],
          summary: "Resolver alerta (admin, operator)",
          security: bearer,
          parameters: [idParam],
          responses: { 200: jsonRef("Alert", "Alerta resuelta"), ...r401, ...r403, ...r404 },
        },
      },

      "/api/v1/dashboard/overview": {
        get: {
          tags: ["Dashboard"],
          summary: "KPIs generales (cache 10s)",
          security: bearer,
          responses: { 200: jsonRef("DashboardOverview", "Resumen"), ...r401 },
        },
      },
      "/api/v1/dashboard/rack/{rackId}": {
        get: {
          tags: ["Dashboard"],
          summary: "Resumen de un rack",
          security: bearer,
          parameters: [{ name: "rackId", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: jsonRef("RackOverview", "Datos del rack"), ...r401 },
        },
      },
      "/api/v1/dashboard/trends": {
        get: {
          tags: ["Dashboard"],
          summary: "Tendencias por periodo",
          security: bearer,
          parameters: [{ name: "hours", in: "query", schema: { type: "integer", default: 24 } }],
          responses: { 200: jsonRef("Trends", "Tendencias"), ...r401 },
        },
      },
    },
  },
  apis: [],
});

export function setupSwagger(app: Express): void {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
  app.get("/docs.json", (_req, res) => {
    res.json(spec);
  });
}
