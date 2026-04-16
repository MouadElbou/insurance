import fp from "fastify-plugin";
import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@insurance/shared";
import { config } from "../config.js";
import { verifyAccessToken } from "../utils/token.js";
import { setupSocketHandlers } from "../socket/socket.handler.js";

export default fp(
  async function socketIoPlugin(fastify: FastifyInstance) {
    const origins = config.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

    const io = new Server<ClientToServerEvents, ServerToClientEvents>(
      fastify.server,
      {
        cors: {
          origin: origins,
          credentials: true,
        },
        transports: ["websocket", "polling"],
      },
    );

    // Socket.IO auth middleware: verify JWT from handshake
    io.use((socket, next) => {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Token d'authentification manquant."));
      }

      try {
        const payload = verifyAccessToken(token);
        // Attach user data to socket for downstream handlers
        (socket.data as { user: typeof payload }).user = payload;
        next();
      } catch {
        next(new Error("Token d'authentification invalide."));
      }
    });

    // Set up all socket event handlers
    setupSocketHandlers(io, fastify.prisma);

    fastify.decorate("io", io);

    fastify.addHook("onClose", async () => {
      io.close();
      fastify.log.info("Socket.IO server closed");
    });

    fastify.log.info("Socket.IO server initialized");
  },
  { name: "socket-io", dependencies: ["prisma"] },
);
