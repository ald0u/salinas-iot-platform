import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer, corsOrigin: string): Server {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin === "*" ? true : corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("subscribe:device", (deviceId: string) => {
      socket.join(`device:${deviceId}`);
    });

    socket.on("unsubscribe:device", (deviceId: string) => {
      socket.leave(`device:${deviceId}`);
    });

    socket.on("subscribe:rack", (rackId: string) => {
      socket.join(`rack:${rackId}`);
    });

    socket.on("acknowledge:alert", (alertId: string) => {
      io?.emit("alert:acknowledged", { alertId });
    });
  });

  return io;
}

export function getSocket(): Server {
  if (!io) {
    throw new Error("Socket.IO no inicializado");
  }
  return io;
}

export function emitEvent(event: string, payload: unknown): void {
  if (io) {
    io.emit(event, payload);
  }
}
