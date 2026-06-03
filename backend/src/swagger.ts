import type { Express } from "express";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const spec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Salinas IoT Platform API",
      version: "1.0.0",
      description: "API para monitoreo IoT en tiempo real",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        CursorPage: {
          type: "object",
          properties: {
            nextCursor: { type: "string", nullable: true },
          },
        },
        AuthTokens: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
          },
        },
        UserSafe: {
          type: "object",
          properties: {
            userId: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["admin", "operator", "viewer"] },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
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
          },
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
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/health": { get: { summary: "Health check", responses: { 200: { description: "OK" } } } },
      "/api/v1/auth/login": {
        post: {
          summary: "Login",
          responses: { 200: { description: "Tokens" } },
        },
      },
      "/api/v1/auth/register": { post: { summary: "Register user", security: [{ bearerAuth: [] }], responses: { 201: { description: "User created" } } } },
      "/api/v1/auth/refresh": { post: { summary: "Refresh token", security: [{ bearerAuth: [] }], responses: { 200: { description: "New tokens" } } } },
      "/api/v1/auth/logout": { post: { summary: "Logout", security: [{ bearerAuth: [] }], responses: { 204: { description: "Logged out" } } } },
      "/api/v1/auth/me": { get: { summary: "Current user", security: [{ bearerAuth: [] }], responses: { 200: { description: "User info" } } } },
      "/api/v1/devices": {
        get: { summary: "List devices", security: [{ bearerAuth: [] }], responses: { 200: { description: "Cursor page" } } },
        post: { summary: "Create device", security: [{ bearerAuth: [] }], responses: { 201: { description: "Device created" } } },
      },
      "/api/v1/devices/stats/summary": { get: { summary: "Device stats summary", security: [{ bearerAuth: [] }], responses: { 200: { description: "Summary" } } } },
      "/api/v1/devices/{id}": {
        get: { summary: "Get device", security: [{ bearerAuth: [] }], responses: { 200: { description: "Device" } } },
        put: { summary: "Update device", security: [{ bearerAuth: [] }], responses: { 200: { description: "Device updated" } } },
        delete: { summary: "Delete device", security: [{ bearerAuth: [] }], responses: { 204: { description: "Deleted" } } },
      },
      "/api/v1/devices/{id}/status": { patch: { summary: "Update device status", security: [{ bearerAuth: [] }], responses: { 200: { description: "Status updated" } } } },
      "/api/v1/devices/{id}/readings": { get: { summary: "Device readings", security: [{ bearerAuth: [] }], responses: { 200: { description: "Readings" } } } },
      "/api/v1/devices/{id}/alerts": { get: { summary: "Device alerts", security: [{ bearerAuth: [] }], responses: { 200: { description: "Alerts" } } } },
      "/api/v1/readings": { get: { summary: "List readings", security: [{ bearerAuth: [] }], responses: { 200: { description: "Cursor page" } } } },
      "/api/v1/readings/batch": { post: { summary: "Batch ingest readings", responses: { 202: { description: "Accepted" } } } },
      "/api/v1/readings/analytics": { get: { summary: "Readings analytics", security: [{ bearerAuth: [] }], responses: { 200: { description: "Analytics" } } } },
      "/api/v1/alerts": { get: { summary: "List alerts", security: [{ bearerAuth: [] }], responses: { 200: { description: "Cursor page" } } } },
      "/api/v1/alerts/{id}/acknowledge": { patch: { summary: "Acknowledge alert", security: [{ bearerAuth: [] }], responses: { 200: { description: "Alert acknowledged" } } } },
      "/api/v1/alerts/{id}/resolve": { patch: { summary: "Resolve alert", security: [{ bearerAuth: [] }], responses: { 200: { description: "Alert resolved" } } } },
      "/api/v1/dashboard/overview": { get: { summary: "Dashboard overview", security: [{ bearerAuth: [] }], responses: { 200: { description: "Overview" } } } },
      "/api/v1/dashboard/rack/{rackId}": { get: { summary: "Rack overview", security: [{ bearerAuth: [] }], responses: { 200: { description: "Rack data" } } } },
      "/api/v1/dashboard/trends": { get: { summary: "Trends", security: [{ bearerAuth: [] }], responses: { 200: { description: "Trends" } } } },
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
