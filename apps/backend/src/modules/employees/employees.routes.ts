import type { FastifyInstance } from "fastify";
import { createEmployeeSchema, updateEmployeeSchema } from "@insurance/shared";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  listHandler,
  getByIdHandler,
  statsHandler,
  bulkStatsHandler,
  createHandler,
  updateHandler,
  removeHandler,
} from "./employees.handler.js";

export default async function employeesRoutes(fastify: FastifyInstance) {
  // All employee routes require authentication
  fastify.addHook("preHandler", authenticate);

  // GET / — list employees (MANAGER only)
  fastify.get("/", {
    preHandler: [authorize("MANAGER")],
    handler: listHandler,
  });

  // GET /bulk-stats — get stats for all employees (MANAGER only)
  fastify.get("/bulk-stats", {
    preHandler: [authorize("MANAGER")],
    handler: bulkStatsHandler,
  });

  // GET /:id — get employee (MANAGER, or own ID for EMPLOYEE)
  fastify.get<{ Params: { id: string } }>("/:id", {
    handler: getByIdHandler,
  });

  // GET /:id/stats — get employee statistics (MANAGER or own stats for EMPLOYEE)
  fastify.get<{ Params: { id: string } }>("/:id/stats", {
    handler: statsHandler,
  });

  // POST / — create employee (MANAGER only)
  fastify.post("/", {
    preHandler: [authorize("MANAGER"), validate(createEmployeeSchema)],
    handler: createHandler,
  });

  // PATCH /:id — update employee (MANAGER only)
  fastify.patch("/:id", {
    preHandler: [authorize("MANAGER"), validate(updateEmployeeSchema)],
    handler: updateHandler,
  });

  // DELETE /:id — soft delete employee (MANAGER only)
  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [authorize("MANAGER")],
    handler: removeHandler,
  });
}
