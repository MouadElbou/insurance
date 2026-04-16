import type { FastifyRequest, FastifyReply } from "fastify";
import type {
  CreateOperationRequest,
  OperationFilters,
} from "@insurance/shared";
import { SOCKET_EVENTS } from "@insurance/shared";
import * as operationsService from "./operations.service.js";

export async function listHandler(
  request: FastifyRequest<{ Querystring: OperationFilters }>,
  reply: FastifyReply,
) {
  const result = await operationsService.list(
    request.server.prisma,
    request.query,
    request.user.sub,
    request.user.role,
  );

  return reply.code(200).send({ success: true, data: result });
}

export async function getByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const operation = await operationsService.getById(
    request.server.prisma,
    request.params.id,
    request.user.sub,
    request.user.role,
  );

  return reply.code(200).send({ success: true, data: operation });
}

export async function createHandler(
  request: FastifyRequest<{ Body: CreateOperationRequest }>,
  reply: FastifyReply,
) {
  const operation = await operationsService.create(
    request.server.prisma,
    request.body,
    request.user.sub,
  );

  // Emit real-time event
  request.server.io.to("dashboard").emit(SOCKET_EVENTS.OPERATION_NEW, {
    operation: {
      id: operation.id,
      employee_name: operation.employee_name ?? "",
      employee_id: operation.employee_id,
      operation_type: operation.type,
      source: operation.source,
      policy_number: operation.policy_number,
      client_name: operation.client_name,
      prime_net: operation.prime_net,
      created_at: operation.created_at,
    },
  });

  return reply.code(201).send({ success: true, data: operation });
}

export async function statsHandler(
  request: FastifyRequest<{
    Querystring: { employee_id?: string; date_from?: string; date_to?: string };
  }>,
  reply: FastifyReply,
) {
  const stats = await operationsService.getStats(
    request.server.prisma,
    request.query,
  );

  return reply.code(200).send({ success: true, data: stats });
}

export async function exportHandler(
  request: FastifyRequest<{
    Querystring: {
      employee_id?: string;
      type?: "PRODUCTION" | "EMISSION";
      source?: "EXCEL" | "MANUAL" | "SCRAPER";
      date_from?: string;
      date_to?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const buffer = await operationsService.exportToExcel(
    request.server.prisma,
    request.query,
  );

  const filename = `operations_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return reply
    .header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    .send(buffer);
}
