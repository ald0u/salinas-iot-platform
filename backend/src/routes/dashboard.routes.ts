import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getOverview, getRackOverview, getTrends } from "../services/dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/overview", async (_req, res, next) => {
  try {
    const result = await getOverview();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/rack/:rackId", async (req, res, next) => {
  try {
    const result = await getRackOverview(req.params.rackId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/trends", async (req, res, next) => {
  try {
    const hours = Number(req.query.hours || 24);
    const result = await getTrends(hours);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
