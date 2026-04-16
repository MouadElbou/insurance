import type { FastifyInstance } from "fastify";
import { uploadQuerySchema } from "@insurance/shared";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createHandler,
  listHandler,
  getByIdHandler,
} from "./uploads.handler.js";

export default async function uploadsRoutes(fastify: FastifyInstance) {
  // All upload routes require auth + MANAGER role
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", authorize("MANAGER"));

  // POST / — upload Excel file, rate limited
  fastify.post("/", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "5 minutes",
      },
    },
    handler: createHandler,
  });

  // GET / — list uploads with filters
  fastify.get("/", {
    preHandler: [validate(uploadQuerySchema, "querystring")],
    handler: listHandler,
  });

  // GET /:id — get upload details
  fastify.get<{ Params: { id: string } }>("/:id", {
    handler: getByIdHandler,
  });
}
