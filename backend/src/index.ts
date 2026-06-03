import express from "express";
import cors from "cors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const app = express();
const port = Number(process.env.PORT || 3000);
const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000";
const dynamoRegion = process.env.DYNAMODB_REGION || "us-east-1";

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "backend" });
});

app.get("/dynamo/health", async (_req, res) => {
  try {
    const client = new DynamoDBClient({
      endpoint: dynamoEndpoint,
      region: dynamoRegion,
      credentials: {
        accessKeyId: "dummy",
        secretAccessKey: "dummy"
      }
    });

    await client.config.region();
    res.json({ status: "ok", dynamodbEndpoint: dynamoEndpoint });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "No se pudo inicializar cliente DynamoDB",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
