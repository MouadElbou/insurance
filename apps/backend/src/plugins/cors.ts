import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

export default fp(
  async function corsPlugin(fastify: FastifyInstance) {
    const origins = config.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

    await fastify.register(cors, {
      origin: origins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
  },
  { name: "cors" },
);
