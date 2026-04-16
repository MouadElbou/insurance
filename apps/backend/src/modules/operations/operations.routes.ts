import type { FastifyInstance } from "fastify";
import {
  operationFiltersSchema,
  createOperationSchema,
} from "@insurance/shared";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  listHandler,
  getByIdHandler,
  createHandler,
  statsHandler,
  exportHandler,
} from "./operations.handler.js";

export default async function operationsRoutes(fastify: FastifyInstance) {
  // All operations routes require authentication
  fastify.addHook("preHandler", authenticate);

  // GET / — list operations with filters
  fastify.get("/", {
    preHandler: [validate(operationFiltersSchema, "querystring")],
    handler: listHandler,
  });

  // GET /stats — MANAGER only
  fastify.get("/stats", {
    preHandler: [authorize("MANAGER")],
    handler: statsHandler,
  });

  // GET /export — MANAGER only, returns Excel file
  fastify.get("/export", {
    preHandler: [authorize("MANAGER")],
    handler: exportHandler,
  });

  // GET /:id — get single operation
  fastify.get<{ Params: { id: string } }>("/:id", {
    handler: getByIdHandler,
  });

  // POST / — create manual operation
  fastify.post("/", {
    preHandler: [validate(createOperationSchema)],
    handler: createHandler,
  });
}
