import { config } from "./config.js";
import { buildApp } from "./app.js";
import { startPresenceChecker, stopPresenceChecker } from "./socket/heartbeat.service.js";
import { logger } from "./utils/logger.js";

async function bootstrap() {
  const app = await buildApp();

  // Start the presence checker (30 s interval for idle/offline detection)
  startPresenceChecker(app.prisma, app.io);

  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info(`Server running on http://${config.HOST}:${config.PORT}`);

  // ── Graceful shutdown ─────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Received shutdown signal");
    stopPresenceChecker();
    await app.close();
    logger.info("Server closed — exiting");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
