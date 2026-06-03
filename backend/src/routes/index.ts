import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { devicesRouter } from "./devices.routes.js";
import { readingsRouter } from "./readings.routes.js";
import { alertsRouter } from "./alerts.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/devices", devicesRouter);
apiRouter.use("/readings", readingsRouter);
apiRouter.use("/alerts", alertsRouter);
apiRouter.use("/dashboard", dashboardRouter);
