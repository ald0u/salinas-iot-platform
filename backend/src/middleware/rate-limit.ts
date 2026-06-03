import rateLimit from "express-rate-limit";

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "RATE_LIMITED",
    message: "Demasiados intentos, intenta nuevamente en 1 minuto",
  },
});
