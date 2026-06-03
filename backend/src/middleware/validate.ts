import type { NextFunction, Request, Response } from "express";
import type Joi from "joi";
import { AppError } from "../utils/errors.js";

export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message).join("; ");
      next(new AppError(`Validación fallida: ${details}`, 400, "VALIDATION_ERROR"));
      return;
    }

    req.body = value;
    next();
  };
}
