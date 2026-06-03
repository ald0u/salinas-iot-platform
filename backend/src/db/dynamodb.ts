import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceInUseException,
  UpdateTimeToLiveCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const region = process.env.DYNAMODB_REGION || "us-east-1";
const endpoint = process.env.DYNAMODB_ENDPOINT;

export const TABLE_NAME = process.env.DYNAMODB_TABLE || "IoTData";

export const ddbClient = new DynamoDBClient({
  region,
  endpoint,
  credentials: endpoint
    ? {
        accessKeyId: "local",
        secretAccessKey: "local",
      }
    : undefined,
});

export const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export async function initializeTable(): Promise<void> {
  try {
    await ddbClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return;
  } catch (error) {
    if (!isTableNotFoundError(error)) {
      throw error;
    }
  }

  try {
    await ddbClient.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        AttributeDefinitions: [
          { AttributeName: "PK", AttributeType: "S" },
          { AttributeName: "SK", AttributeType: "S" },
          { AttributeName: "GSI1PK", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "GSI1",
            KeySchema: [
              { AttributeName: "GSI1PK", KeyType: "HASH" },
              { AttributeName: "SK", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
        ],
        BillingMode: "PAY_PER_REQUEST",
      }),
    );
  } catch (error) {
    if (!(error instanceof ResourceInUseException)) {
      throw error;
    }
  }

  await waitUntilTableExists(
    { client: ddbClient, maxWaitTime: 30 },
    { TableName: TABLE_NAME },
  );

  await ddbClient.send(
    new UpdateTimeToLiveCommand({
      TableName: TABLE_NAME,
      TimeToLiveSpecification: {
        AttributeName: "TTL",
        Enabled: true,
      },
    }),
  );
}

function isTableNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "ResourceNotFoundException";
}