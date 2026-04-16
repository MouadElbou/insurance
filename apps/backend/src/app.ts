import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { config } from "./config.js";

// Plugins
import prismaPlugin from "./plugins/prisma.js";
import corsPlugin from "./plugins/cors.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import socketIoPlugin from "./plugins/socket-io.js";

// Services
import { cleanExpiredTokens } from "./modules/auth/auth.service.js";

// Route modules
import authRoutes from "./modules/auth/auth.routes.js";
import employeesRoutes from "./modules/employees/employees.routes.js";
import operationsRoutes from "./modules/operations/operations.routes.js";
import uploadsRoutes from "./modules/uploads/uploads.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";

// Type augmentations (side-effect import — loads FastifyInstance & FastifyRequest overrides)
import "./types.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
      transport:
        config.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // ── Core plugins (order matters) ──────────────────────────────────
  await app.register(prismaPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(errorHandlerPlugin);

  // Multipart for file uploads (must be registered before upload routes)
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 1,
    },
  });

  // Socket.IO (depends on prisma plugin)
  await app.register(socketIoPlugin);

  // ── Health check ──────────────────────────────────────────────────
  app.get("/health", async () => {
    let dbStatus = "disconnected";
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";
    } catch {
      dbStatus = "disconnected";
    }

    return {
      status: "ok",
      db: dbStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  });

  // ── API routes (all prefixed under /api/v1) ──────────────────────
  await app.register(
    async function apiV1(api) {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(employeesRoutes, { prefix: "/employees" });
      await api.register(operationsRoutes, { prefix: "/operations" });
      await api.register(uploadsRoutes, { prefix: "/uploads" });
      await api.register(dashboardRoutes, { prefix: "/dashboard" });
    },
    { prefix: "/api/v1" },
  );

  // ── Scheduled tasks ────────────────────────────────────────────────
  app.addHook("onReady", async () => {
    // Clean expired/revoked refresh tokens every hour
    const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
    const interval = setInterval(async () => {
      try {
        const count = await cleanExpiredTokens(app.prisma);
        if (count > 0) {
          app.log.info({ count }, "Cleaned expired refresh tokens");
        }
      } catch (err) {
        app.log.error({ err }, "Failed to clean expired refresh tokens");
      }
    }, CLEANUP_INTERVAL_MS);

    // Clean up on shutdown
    app.addHook("onClose", async () => {
      clearInterval(interval);
    });
  });

  return app;
}
