/**
 * Thin Fastify controllers for the scraper module.
 *
 * Responsibilities:
 *   1. Resolve the request's `RequestUser { sub, role, operator_code }` tuple.
 *      `operator_code` is NOT in the JWT (see `TokenPayload`), so we fetch it
 *      from the Employee row by `request.user.sub`. One extra indexed PK read
 *      per protected request — cheap, and it guarantees we never emit the
 *      wrong `operator_code` if an employee is renamed between token issue and
 *      request time.
 *   2. Dispatch to the service with typed body/query/params.
 *   3. Wrap success responses in `{ success: true, data }`. Let the global
 *      error handler translate thrown errors into `{ success: false, error }`.
 *
 * We do NOT do any business logic here — persistence, sanitization, verdict
 * write-back, Socket.IO emission all live in `scraper.service.ts`.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  InsurerDomainInput,
  Role,
  ScraperBatchRequest,
  ScraperEventsQuery,
} from "@insurance/shared";
import * as scraperService from "./scraper.service.js";

// ─── User resolution ──────────────────────────────────────────────────
//
// The service expects `{ sub, role, operator_code }` but JWT only carries
// `{ sub, role }`. Centralize the DB lookup here so every handler uses the
// same resolution + error handling path.

interface ResolvedUser {
  sub: string;
  role: Role;
  operator_code: string;
}

async function resolveRequestUser(
  request: FastifyRequest,
): Promise<ResolvedUser> {
  const employee = await request.server.prisma.employee.findUnique({
    where: { id: request.user.sub },
    select: { operator_code: true },
  });

  if (!employee) {
    // A valid JWT whose sub no longer resolves to an employee — force the
    // client to re-auth. Token may have been issued before the employee was
    // deleted, so treat as "unauthorized" rather than "not found".
    throw Object.assign(new Error("Utilisateur introuvable."), {
      statusCode: 401,
      code: "AUTH_USER_NOT_FOUND",
    });
  }

  return {
    sub: request.user.sub,
    role: request.user.role,
    operator_code: employee.operator_code,
  };
}

// ─── POST /events ─────────────────────────────────────────────────────
//
// Accept a validated batch of captured HTTP exchanges. 200 OK — the response
// body is a summary with accepted/rejected counts and a batch_id echo. We
// return 200 (not 201) because partial acceptance is possible and the
// response is a report rather than a created resource.

export async function ingestHandler(
  request: FastifyRequest<{ Body: ScraperBatchRequest }>,
  reply: FastifyReply,
) {
  const user = await resolveRequestUser(request);
  const result = await scraperService.ingestEvents(
    request.server.prisma,
    request.server.io,
    request.body,
    user,
  );
  return reply.code(200).send({ success: true, data: result });
}

// ─── GET /events ──────────────────────────────────────────────────────

export async function listEventsHandler(
  request: FastifyRequest<{ Querystring: ScraperEventsQuery }>,
  reply: FastifyReply,
) {
  const user = await resolveRequestUser(request);
  const result = await scraperService.listEvents(
    request.server.prisma,
    request.query,
    user,
  );
  return reply.code(200).send({ success: true, data: result });
}

// ─── GET /events/stats ────────────────────────────────────────────────
//
// EMPLOYEE role is scoped to own stats automatically. MANAGER may pass
// `employee_id` to scope to a specific employee, or omit for global stats.

export async function statsHandler(
  request: FastifyRequest<{ Querystring: { employee_id?: string } }>,
  reply: FastifyReply,
) {
  const user = await resolveRequestUser(request);
  const employeeId =
    user.role === "EMPLOYEE" ? user.sub : request.query.employee_id;
  const stats = await scraperService.getStats(
    request.server.prisma,
    employeeId,
  );
  return reply.code(200).send({ success: true, data: stats });
}

// ─── GET /events/:id ──────────────────────────────────────────────────

export async function getEventHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = await resolveRequestUser(request);
  const event = await scraperService.getEvent(
    request.server.prisma,
    request.params.id,
    user,
  );
  return reply.code(200).send({ success: true, data: event });
}

// ─── POST /events/:id/replay ──────────────────────────────────────────
//
// MANAGER-only (enforced at route level). Re-runs the transformer on a
// single persisted event. Useful after a transformer bugfix.

export async function replayEventHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await scraperService.replayEvent(
    request.server.prisma,
    request.server.io,
    request.params.id,
  );
  return reply.code(200).send({ success: true, data: result });
}

// ─── GET /insurer-domains ─────────────────────────────────────────────

export async function listDomainsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const domains = await scraperService.listDomains(request.server.prisma);
  return reply.code(200).send({ success: true, data: domains });
}

// ─── POST /insurer-domains ────────────────────────────────────────────

export async function createDomainHandler(
  request: FastifyRequest<{ Body: InsurerDomainInput }>,
  reply: FastifyReply,
) {
  const domain = await scraperService.createDomain(
    request.server.prisma,
    request.body,
    request.user.sub,
  );
  return reply.code(201).send({ success: true, data: domain });
}

// ─── PUT /insurer-domains/:id ─────────────────────────────────────────

export async function updateDomainHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: InsurerDomainInput;
  }>,
  reply: FastifyReply,
) {
  const domain = await scraperService.updateDomain(
    request.server.prisma,
    request.params.id,
    request.body,
  );
  return reply.code(200).send({ success: true, data: domain });
}

// ─── DELETE /insurer-domains/:id ──────────────────────────────────────

export async function deleteDomainHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await scraperService.deleteDomain(request.server.prisma, request.params.id);
  return reply.code(204).send();
}
