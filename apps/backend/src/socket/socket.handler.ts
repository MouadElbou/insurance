import type { PrismaClient } from "@prisma/client";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  TokenPayload,
  PresenceUpdatePayload,
} from "@insurance/shared";
import { SOCKET_EVENTS } from "./events.js";
import { handleHeartbeat } from "./heartbeat.service.js";
import { logger } from "../utils/logger.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Register all Socket.IO event handlers.
 * Called once during server startup from the socket-io plugin.
 */
export function setupSocketHandlers(io: IO, prisma: PrismaClient): void {
  io.on("connection", (socket: AppSocket) => {
    const user = (socket.data as { user: TokenPayload }).user;

    if (!user?.sub) {
      logger.warn("Socket connected without valid user data — disconnecting");
      socket.disconnect(true);
      return;
    }

    const userId = user.sub;

    // Join a private room for targeted events (e.g., per-user notifications)
    socket.join(`user:${userId}`);

    logger.debug({ userId, socketId: socket.id }, "Socket connected");

    // ── heartbeat ───────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.HEARTBEAT, () => {
      handleHeartbeat(prisma, io, userId).catch((err) => {
        logger.error({ err, userId }, "Heartbeat handler error");
      });
    });

    // ── join:dashboard ──────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.JOIN_DASHBOARD, () => {
      socket.join("dashboard");
      logger.debug({ userId, socketId: socket.id }, "Joined dashboard room");
    });

    // ── leave:dashboard ─────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.LEAVE_DASHBOARD, () => {
      socket.leave("dashboard");
      logger.debug({ userId, socketId: socket.id }, "Left dashboard room");
    });

    // ── disconnect ──────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      logger.debug({ userId, socketId: socket.id, reason }, "Socket disconnected");

      // Broadcast offline status to dashboard viewers
      const payload: PresenceUpdatePayload = {
        employee_id: userId,
        status: "offline",
        last_heartbeat: new Date().toISOString(),
      };

      io.to("dashboard").emit(SOCKET_EVENTS.PRESENCE_UPDATE, payload);
    });
  });
}
