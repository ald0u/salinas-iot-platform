import { BatchWriteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../config/env.js";
import { ddbDocClient } from "../db/dynamodb.js";
import { logger } from "../utils/logger.js";
import { listDevices } from "./device.service.js";

/**
 * Borra las lecturas más viejas que `readingsRetentionHours` para que la tabla
 * (DynamoDB Local corre en memoria) no crezca sin límite. Solo toca items cuyo
 * SK empieza con "READING#" — nunca METADATA, alertas ni usuarios.
 */
export async function pruneOldReadings(): Promise<void> {
  try {
    const cutoff = `READING#${new Date(Date.now() - env.readingsRetentionHours * 3600 * 1000).toISOString()}`;
    const devices = (await listDevices(1000)).items;
    let deleted = 0;

    for (const device of devices) {
      let startKey: Record<string, unknown> | undefined;

      do {
        const result = await ddbDocClient.send(
          new QueryCommand({
            TableName: env.dynamodbTable,
            // Solo lecturas (SK entre "READING#" y el corte). Excluye METADATA.
            KeyConditionExpression: "PK = :pk AND SK BETWEEN :lo AND :cut",
            ExpressionAttributeValues: {
              ":pk": `DEVICE#${device.deviceId}`,
              ":lo": "READING#",
              ":cut": cutoff,
            },
            ProjectionExpression: "PK, SK",
            ExclusiveStartKey: startKey,
          }),
        );

        const keys = (result.Items || []) as Array<{ PK: string; SK: string }>;
        for (let i = 0; i < keys.length; i += 25) {
          const chunk = keys.slice(i, i + 25);
          await ddbDocClient.send(
            new BatchWriteCommand({
              RequestItems: {
                [env.dynamodbTable]: chunk.map((k) => ({ DeleteRequest: { Key: { PK: k.PK, SK: k.SK } } })),
              },
            }),
          );
          deleted += chunk.length;
        }

        startKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (startKey);
    }

    if (deleted > 0) {
      logger.info("Limpieza de lecturas viejas", { deleted, retentionHours: env.readingsRetentionHours });
    }
  } catch (error) {
    logger.error("Error en la limpieza de lecturas", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
