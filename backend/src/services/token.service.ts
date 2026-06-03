import jwt from "jsonwebtoken";
import { DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ddbDocClient } from "../db/dynamodb.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

function computeTtlFromDays(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

export function signAccessToken(user: { userId: string; email: string; role: string }): string {
  const payload: AccessTokenPayload = {
    sub: user.userId,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, env.accessSecret, {
    expiresIn: env.accessExpiry as jwt.SignOptions["expiresIn"],
  });
}

export async function signAndStoreRefreshToken(userId: string): Promise<string> {
  const tokenId = randomUUID();
  const token = jwt.sign({ sub: userId, jti: tokenId }, env.refreshSecret, {
    expiresIn: env.refreshExpiry as jwt.SignOptions["expiresIn"],
  });

  const ttl = computeTtlFromDays(7);

  await ddbDocClient.send(
    new PutCommand({
      TableName: env.dynamodbTable,
      Item: {
        PK: `USER#${userId}`,
        SK: `REFRESH#${tokenId}`,
        entity: "REFRESH_TOKEN",
        userId,
        tokenId,
        expiresAt: new Date(ttl * 1000).toISOString(),
        TTL: ttl,
      },
    }),
  );

  return token;
}

export async function rotateRefreshToken(token: string): Promise<{ userId: string; refreshToken: string }> {
  let payload: RefreshTokenPayload;

  try {
    payload = jwt.verify(token, env.refreshSecret) as RefreshTokenPayload;
  } catch {
    throw new AppError("Refresh token inválido", 401, "UNAUTHORIZED");
  }

  await ddbDocClient.send(
    new DeleteCommand({
      TableName: env.dynamodbTable,
      Key: {
        PK: `USER#${payload.sub}`,
        SK: `REFRESH#${payload.jti}`,
      },
    }),
  );

  const refreshToken = await signAndStoreRefreshToken(payload.sub);
  return { userId: payload.sub, refreshToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const payload = jwt.verify(token, env.refreshSecret) as RefreshTokenPayload;
    await ddbDocClient.send(
      new DeleteCommand({
        TableName: env.dynamodbTable,
        Key: {
          PK: `USER#${payload.sub}`,
          SK: `REFRESH#${payload.jti}`,
        },
      }),
    );
  } catch (error) {
    if (isJwtValidationError(error)) {
      return;
    }

    logger.error("Error al revocar refresh token", {
      message: error instanceof Error ? error.message : String(error),
    });

    throw new AppError("No se pudo cerrar sesión", 500, "TOKEN_REVOKE_FAILED");
  }
}

function isJwtValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "JsonWebTokenError" || error.name === "TokenExpiredError";
}
