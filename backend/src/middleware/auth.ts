import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import type { UserRole } from "../types/domain.js";

interface AccessPayload {
  sub: string;
  email: string;
  role: UserRole;
}

function extractBearerToken(req: Request): string {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new AppError("Token no proporcionado", 401, "UNAUTHORIZED");
  }
  return auth.slice(7);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req);
    const payload = jwt.verify(token, env.accessSecret) as AccessPayload;

    req.user = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch {
    next(new AppError("Token inválido o expirado", 401, "UNAUTHORIZED"));
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("No autenticado", 401, "UNAUTHORIZED"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError("No tienes permisos para esta acción", 403, "FORBIDDEN"));
      return;
    }

    next();
  };
}
