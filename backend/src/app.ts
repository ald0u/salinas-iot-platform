import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { sanitizeInput } from "./middleware/sanitize.js";
import { setupSwagger } from "./swagger.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin === "*" ? true : env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(sanitizeInput);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "backend", now: new Date().toISOString() });
});

app.use("/api/v1", apiRouter);
setupSwagger(app);

app.use(notFoundHandler);
app.use(errorHandler);
