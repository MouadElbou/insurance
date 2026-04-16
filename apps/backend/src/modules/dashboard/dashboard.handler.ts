import type { FastifyRequest, FastifyReply } from "fastify";
import * as dashboardService from "./dashboard.service.js";

export async function kpisHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const kpis = await dashboardService.getKpis(request.server.prisma);
  return reply.code(200).send({ success: true, data: kpis });
}

export async function activityHandler(
  request: FastifyRequest<{ Querystring: { limit?: string } }>,
  reply: FastifyReply,
) {
  const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
  const activity = await dashboardService.getActivity(
    request.server.prisma,
    isNaN(limit) ? 20 : limit,
  );

  return reply.code(200).send({ success: true, data: activity });
}

export async function presenceHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const presence = await dashboardService.getPresence(request.server.prisma);
  return reply.code(200).send({ success: true, data: presence });
}
