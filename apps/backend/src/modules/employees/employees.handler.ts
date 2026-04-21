import type { FastifyRequest, FastifyReply } from "fastify";
import type {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
} from "@insurance/shared";
import { SOCKET_EVENTS } from "@insurance/shared";
import * as employeesService from "./employees.service.js";
import * as operationsService from "../operations/operations.service.js";

interface EmployeeParams {
  id: string;
}

interface ListQuery {
  is_active?: string;
  role?: "MANAGER" | "EMPLOYEE";
  search?: string;
  page?: string;
  per_page?: string;
}

export async function listHandler(
  request: FastifyRequest<{ Querystring: ListQuery }>,
  reply: FastifyReply,
) {
  const { is_active, role, search, page, per_page } = request.query;
  const filters: {
    is_active?: boolean;
    role?: "MANAGER" | "EMPLOYEE";
    search?: string;
    page?: number;
    per_page?: number;
  } = {};

  if (is_active !== undefined) {
    filters.is_active = is_active === "true";
  }
  if (role) filters.role = role;
  if (search) filters.search = search;
  if (page) filters.page = Math.max(1, parseInt(page, 10) || 1);
  if (per_page) filters.per_page = Math.min(100, Math.max(1, parseInt(per_page, 10) || 25));

  const result = await employeesService.list(request.server.prisma, filters);
  return reply.code(200).send({ success: true, data: result });
}

export async function getByIdHandler(
  request: FastifyRequest<{ Params: EmployeeParams }>,
  reply: FastifyReply,
) {
  const { id } = request.params;

  // EMPLOYEE can only view their own profile
  if (request.user.role === "EMPLOYEE" && request.user.sub !== id) {
    return reply.code(403).send({
      success: false,
      error: {
        code: "AUTH_INSUFFICIENT_ROLE",
        message: "Vous ne pouvez consulter que votre propre profil.",
      },
    });
  }

  const employee = await employeesService.getById(request.server.prisma, id);
  return reply.code(200).send({ success: true, data: employee });
}

export async function statsHandler(
  request: FastifyRequest<{ Params: EmployeeParams }>,
  reply: FastifyReply,
) {
  const { id } = request.params;

  // EMPLOYEE can only view their own stats
  if (request.user.role === "EMPLOYEE" && request.user.sub !== id) {
    return reply.code(403).send({
      success: false,
      error: {
        code: "AUTH_INSUFFICIENT_ROLE",
        message: "Vous ne pouvez consulter que vos propres statistiques.",
      },
    });
  }

  const stats = await operationsService.getStats(request.server.prisma, { employee_id: id });
  return reply.code(200).send({ success: true, data: stats });
}

export async function bulkStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const employees = await employeesService.list(request.server.prisma, { is_active: true, per_page: 100 });
  const ids = employees.items.map((e: { id: string }) => e.id);

  const statsMap: Record<string, any> = {};
  await Promise.all(
    ids.map(async (id: string) => {
      const stats = await operationsService.getStats(request.server.prisma, { employee_id: id });
      statsMap[id] = stats;
    }),
  );

  return reply.code(200).send({ success: true, data: statsMap });
}

export async function createHandler(
  request: FastifyRequest<{ Body: CreateEmployeeRequest }>,
  reply: FastifyReply,
) {
  const employee = await employeesService.create(
    request.server.prisma,
    request.body,
  );

  // Notify dashboard room
  request.server.io
    .to("dashboard")
    .emit(SOCKET_EVENTS.EMPLOYEE_UPDATED, { employee });

  return reply.code(201).send({ success: true, data: employee });
}

export async function updateHandler(
  request: FastifyRequest<{ Params: EmployeeParams; Body: UpdateEmployeeRequest }>,
  reply: FastifyReply,
) {
  const employee = await employeesService.update(
    request.server.prisma,
    request.params.id,
    request.body,
  );

  // Notify dashboard room
  request.server.io
    .to("dashboard")
    .emit(SOCKET_EVENTS.EMPLOYEE_UPDATED, { employee });

  return reply.code(200).send({ success: true, data: employee });
}

export async function removeHandler(
  request: FastifyRequest<{ Params: EmployeeParams }>,
  reply: FastifyReply,
) {
  await employeesService.remove(request.server.prisma, request.params.id);

  // Fetch updated employee data for the socket event
  const employee = await employeesService.getById(
    request.server.prisma,
    request.params.id,
  );

  request.server.io
    .to("dashboard")
    .emit(SOCKET_EVENTS.EMPLOYEE_UPDATED, { employee });

  return reply.code(204).send();
}
