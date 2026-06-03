import bcrypt from "bcryptjs";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ddbDocClient } from "../db/dynamodb.js";
import { AppError } from "../utils/errors.js";
import { rotateRefreshToken, signAccessToken, signAndStoreRefreshToken } from "./token.service.js";
import type { User, UserRole } from "../types/domain.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

async function findUserByEmail(email: string): Promise<User | null> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: env.dynamodbTable,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `EMAIL#${email.toLowerCase()}`,
      },
      Limit: 1,
    }),
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return result.Items[0] as User;
}

export async function registerUser(input: {
  email: string;
  password: string;
  role: UserRole;
  requesterRole: UserRole;
}): Promise<{ user: Omit<User, "passwordHash">; tokens: AuthTokens }> {
  if (input.requesterRole !== "admin") {
    throw new AppError("Solo admin puede registrar usuarios", 403, "FORBIDDEN");
  }

  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new AppError("El email ya está registrado", 409, "CONFLICT");
  }

  const now = new Date().toISOString();
  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 10);

  const user: User = {
    PK: `USER#${userId}`,
    SK: "METADATA",
    entity: "USER",
    userId,
    GSI1PK: `EMAIL#${input.email.toLowerCase()}`,
    email: input.email.toLowerCase(),
    passwordHash,
    role: input.role,
    isActive: true,
    createdAt: now,
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: env.dynamodbTable,
      Item: user,
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  const accessToken = signAccessToken({ userId, email: user.email, role: user.role });
  const refreshToken = await signAndStoreRefreshToken(userId);

  const { passwordHash: _ignored, ...safeUser } = user;
  return { user: safeUser, tokens: { accessToken, refreshToken } };
}

export async function loginUser(email: string, password: string): Promise<{ user: Omit<User, "passwordHash">; tokens: AuthTokens }> {
  const user = await findUserByEmail(email);

  if (!user || !user.isActive) {
    throw new AppError("Credenciales inválidas", 401, "UNAUTHORIZED");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError("Credenciales inválidas", 401, "UNAUTHORIZED");
  }

  const accessToken = signAccessToken({ userId: user.userId, email: user.email, role: user.role });
  const refreshToken = await signAndStoreRefreshToken(user.userId);

  const { passwordHash: _ignored, ...safeUser } = user;
  return { user: safeUser, tokens: { accessToken, refreshToken } };
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const rotated = await rotateRefreshToken(refreshToken);

  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: env.dynamodbTable,
      Key: { PK: `USER#${rotated.userId}`, SK: "METADATA" },
    }),
  );

  if (!result.Item) {
    throw new AppError("Usuario no encontrado", 404, "NOT_FOUND");
  }

  const user = result.Item as User;
  const accessToken = signAccessToken({ userId: user.userId, email: user.email, role: user.role });

  return { accessToken, refreshToken: rotated.refreshToken };
}
