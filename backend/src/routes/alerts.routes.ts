import { Router } from "express";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { acknowledgeAlert, listAlerts, resolveAlert } from "../services/alert.service.js";

export const alertsRouter = Router();

alertsRouter.use(requireAuth);

alertsRouter.get("/", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 100);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const result = await listAlerts(limit, cursor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

alertsRouter.patch("/:id/acknowledge", requireRoles("admin", "operator"), async (req, res, next) => {
  try {
    const item = await acknowledgeAlert(String(req.params.id));
    res.json(item);
  } catch (error) {
    next(error);
  }
});

alertsRouter.patch("/:id/resolve", requireRoles("admin", "operator"), async (req, res, next) => {
  try {
    const item = await resolveAlert(String(req.params.id));
    res.json(item);
  } catch (error) {
    next(error);
  }
});
