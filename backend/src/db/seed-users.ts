import bcrypt from "bcryptjs";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { ddbDocClient } from "./dynamodb.js";

const TABLE_NAME = process.env.DYNAMODB_TABLE || "IoTData";

async function seedAdmin(): Promise<void> {
  const userId = randomUUID();
  const email = process.env.SEED_ADMIN_EMAIL || "admin@salinas.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin1234!";
  const passwordHash = await bcrypt.hash(password, 10);

  await ddbDocClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${userId}`,
        SK: "METADATA",
        entity: "USER",
        userId,
        GSI1PK: `EMAIL#${email}`,
        email,
        passwordHash,
        role: "admin",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  console.log(`Admin creado: ${email}`);
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
