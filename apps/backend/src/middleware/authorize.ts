import type { FastifyRequest, FastifyReply } from "fastify";
import type { Role } from "@insurance/shared";

/**
 * Factory function that returns a Fastify preHandler checking the
 * authenticated user's role against an allow-list.
 */
export function authorize(...roles: Role[]) {
  return async function authorizeHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: "AUTH_TOKEN_MISSING",
          message: "Token d'authentification manquant.",
        },
      });
    }

    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({
        success: false,
        error: {
          code: "AUTH_INSUFFICIENT_ROLE",
          message: "Vous n'avez pas les droits necessaires pour cette action.",
        },
      });
    }
  };
}
