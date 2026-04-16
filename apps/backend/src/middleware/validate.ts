import type { FastifyRequest, FastifyReply } from "fastify";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

/**
 * Factory function that returns a Fastify preHandler validating
 * request.body or request.query against a Zod schema.
 * On success, replaces the source with the parsed (cleaned) result.
 */
export function validate(
  schema: ZodSchema,
  source: "body" | "querystring" = "body",
) {
  return async function validateHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const data = source === "body" ? request.body : request.query;

    try {
      const parsed = schema.parse(data);
      if (source === "body") {
        (request as { body: unknown }).body = parsed;
      } else {
        (request as { query: unknown }).query = parsed;
      }
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Donnees de requete invalides.",
            details: err.errors.map((e) => ({
              path: e.path.join("."),
              message: e.message,
            })),
          },
        });
      }
      throw err;
    }
  };
}
