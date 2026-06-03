import type { NextFunction, Request, Response } from "express";
import { isAppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: "Endpoint no encontrado" });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (isAppError(error)) {
    res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
    });
    return;
  }

  logger.error("Unhandled error", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    method: req.method,
    path: req.path,
  });

  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Ocurrió un error inesperado",
  });
}
