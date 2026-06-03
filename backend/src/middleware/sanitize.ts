import type { NextFunction, Request, Response } from "express";
import { sanitizeBody } from "../utils/sanitize.js";

export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  req.body = sanitizeBody(req.body);
  next();
}
