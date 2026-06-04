import { Router } from "express";
import Joi from "joi";
import { authRateLimit } from "../middleware/rate-limit.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { loginUser, refreshTokens, registerUser } from "../services/auth.service.js";
import { revokeRefreshToken } from "../services/token.service.js";

const registerSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid("admin", "operator", "viewer").required(),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const authRouter = Router();

authRouter.post("/register", requireAuth, requireRoles("admin"), validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await registerUser({
      email: req.body.email,
      password: req.body.password,
      role: req.body.role,
      requesterRole: req.user!.role,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", authRateLimit, validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await loginUser(req.body.email, req.body.password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", requireAuth, validateBody(refreshSchema), async (req, res, next) => {
  try {
    const result = await refreshTokens(req.body.refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", requireAuth, validateBody(refreshSchema), async (req, res, next) => {
  try {
    await revokeRefreshToken(req.body.refreshToken);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});
