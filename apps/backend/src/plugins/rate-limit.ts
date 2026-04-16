import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

export default fp(
  async function rateLimitPlugin(fastify: FastifyInstance) {
    await fastify.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute",
      errorResponseBuilder: () => ({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Trop de requetes. Veuillez reessayer plus tard.",
        },
      }),
    });
  },
  { name: "rate-limit" },
);
