import { Router } from "express";
import Joi from "joi";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  createDevice,
  deleteDevice,
  getDevice,
  getDeviceAlerts,
  getDeviceReadings,
  getDeviceStatsSummary,
  listDevices,
  patchDeviceStatus,
  updateDevice,
} from "../services/device.service.js";
import { emitEvent } from "../services/socket.service.js";

const locationSchema = Joi.object({
  rack: Joi.string().required(),
  position: Joi.number().integer().min(1).required(),
  floor: Joi.number().integer().min(1).required(),
});

const thresholdsSchema = Joi.object({
  min: Joi.number().required(),
  max: Joi.number().required(),
  criticalMin: Joi.number().required(),
  criticalMax: Joi.number().required(),
});

const metadataSchema = Joi.object({
  manufacturer: Joi.string().required(),
  model: Joi.string().required(),
  firmwareVersion: Joi.string().required(),
});

const deviceSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid("temperature", "humidity", "power", "ups", "cooling").required(),
  location: locationSchema.required(),
  status: Joi.string().valid("online", "offline", "maintenance", "critical").required(),
  thresholds: thresholdsSchema.required(),
  metadata: metadataSchema.required(),
});

const statusSchema = Joi.object({
  status: Joi.string().valid("online", "offline", "maintenance", "critical").required(),
});

export const devicesRouter = Router();

devicesRouter.use(requireAuth);

devicesRouter.get("/", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 20);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const result = await listDevices(limit, cursor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

devicesRouter.get("/stats/summary", async (_req, res, next) => {
  try {
    const stats = await getDeviceStatsSummary();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

devicesRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await getDevice(req.params.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

devicesRouter.post("/", requireRoles("admin", "operator"), validateBody(deviceSchema), async (req, res, next) => {
  try {
    const item = await createDevice(req.body);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

devicesRouter.put("/:id", requireRoles("admin", "operator"), validateBody(deviceSchema), async (req, res, next) => {
  try {
    const item = await updateDevice(String(req.params.id), req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

devicesRouter.patch("/:id/status", requireRoles("admin", "operator"), validateBody(statusSchema), async (req, res, next) => {
  try {
    const item = await patchDeviceStatus(String(req.params.id), req.body.status);
    emitEvent("device:status", item);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

devicesRouter.delete("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    await deleteDevice(String(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

devicesRouter.get("/:id/readings", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 50);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const result = await getDeviceReadings(req.params.id, limit, cursor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

devicesRouter.get("/:id/alerts", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 50);
    const items = await getDeviceAlerts(req.params.id, limit);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});
