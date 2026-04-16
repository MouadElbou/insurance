import pino from "pino";
import { config } from "../config.js";

/**
 * Standalone logger for use outside of Fastify request context.
 * Used by services, background tasks, and ingestion pipeline.
 */
export const logger = pino({
  level: config.NODE_ENV === "production" ? "info" : "debug",
  transport:
    config.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
