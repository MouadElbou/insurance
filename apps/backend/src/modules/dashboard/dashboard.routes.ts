import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  kpisHandler,
  activityHandler,
  presenceHandler,
  chartsHandler,
} from "./dashboard.handler.js";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // All dashboard routes require auth + MANAGER role
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", authorize("MANAGER"));

  // GET /kpis
  fastify.get("/kpis", { handler: kpisHandler });

  // GET /activity — optional ?limit query param
  fastify.get("/activity", { handler: activityHandler });

  // GET /presence
  fastify.get("/presence", { handler: presenceHandler });

  // GET /charts — monthly trend, type/source breakdown, top employees, daily volume
  fastify.get("/charts", { handler: chartsHandler });
}
