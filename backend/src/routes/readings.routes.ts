import { Router } from "express";
import Joi from "joi";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { AppError } from "../utils/errors.js";
import { ingestBatchReadings, ingestReading, listReadings, readingsAnalytics } from "../services/reading.service.js";
import { env } from "../config/env.js";

const readingSchema = Joi.object({
  deviceId: Joi.string().required(),
  value: Joi.number().required(),
  unit: Joi.string().required(),
  quality: Joi.string().valid("good", "uncertain", "bad").required(),
  timestamp: Joi.string().isoDate().required(),
});

const batchSchema = Joi.object({
  readings: Joi.array().items(readingSchema).min(1).required(),
});

export const readingsRouter = Router();

readingsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 100);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const result = await listReadings(limit, cursor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

readingsRouter.post("/batch", validateBody(batchSchema), async (req, res, next) => {
  try {
    const systemKey = req.header("x-system-key");
    if (!req.user && systemKey !== env.systemIngestKey) {
      throw new AppError("No autorizado para ingestar lecturas", 401, "UNAUTHORIZED");
    }

    const result = await ingestBatchReadings(req.body.readings);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

readingsRouter.get("/analytics", requireAuth, async (req, res, next) => {
  try {
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : undefined;
    const result = await readingsAnalytics(deviceId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

readingsRouter.post("/single", requireAuth, validateBody(readingSchema), async (req, res, next) => {
  try {
    const result = await ingestReading(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
