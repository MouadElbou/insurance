import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../utils/token.js";

/**
 * Fastify preHandler that extracts and verifies the Bearer JWT token
 * from the Authorization header. Attaches decoded payload to request.user.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({
      success: false,
      error: {
        code: "AUTH_TOKEN_MISSING",
        message: "Token d'authentification manquant.",
      },
    });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch (err: unknown) {
    const isExpired =
      err instanceof Error && err.name === "TokenExpiredError";
    return reply.code(401).send({
      success: false,
      error: {
        code: isExpired ? "AUTH_TOKEN_EXPIRED" : "AUTH_TOKEN_INVALID",
        message: isExpired
          ? "Le token a expire."
          : "Token d'authentification invalide.",
      },
    });
  }
}
