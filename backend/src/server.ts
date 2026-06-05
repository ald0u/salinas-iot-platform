import http from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { initSocket } from "./services/socket.service.js";
import { initMqttSubscriber } from "./services/mqtt.service.js";
import { pruneOldReadings } from "./services/maintenance.service.js";
import { initializeTable } from "./db/dynamodb.js";

async function bootstrap(): Promise<void> {
  await initializeTable();

  const server = http.createServer(app);
  initSocket(server, env.corsOrigin);
  initMqttSubscriber();

  server.listen(env.port, () => {
    logger.info("Backend iniciado", {
      port: env.port,
      env: env.nodeEnv,
      docs: `http://localhost:${env.port}/docs`,
    });
  });

  setTimeout(() => void pruneOldReadings(), 60_000);
  setInterval(() => void pruneOldReadings(), 30 * 60 * 1000);
}

bootstrap().catch((error) => {
  logger.error("Error al iniciar backend", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
