import type { FastifyRequest, FastifyReply } from "fastify";
import type { LoginRequest, RefreshRequest } from "@insurance/shared";
import * as authService from "./auth.service.js";

export async function meHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = await authService.getMe(
    request.server.prisma,
    request.user.sub,
  );

  return reply.code(200).send({
    success: true,
    data: user,
  });
}

export async function loginHandler(
  request: FastifyRequest<{ Body: LoginRequest }>,
  reply: FastifyReply,
) {
  const { email, password } = request.body;
  const result = await authService.login(
    request.server.prisma,
    email,
    password,
  );

  return reply.code(200).send({
    success: true,
    data: result,
  });
}

export async function refreshHandler(
  request: FastifyRequest<{ Body: RefreshRequest }>,
  reply: FastifyReply,
) {
  const { refresh_token } = request.body;
  const result = await authService.refresh(
    request.server.prisma,
    refresh_token,
  );

  return reply.code(200).send({
    success: true,
    data: result,
  });
}

export async function logoutHandler(
  request: FastifyRequest<{ Body: RefreshRequest }>,
  reply: FastifyReply,
) {
  const { refresh_token } = request.body;
  await authService.logout(request.server.prisma, refresh_token);

  return reply.code(204).send();
}
