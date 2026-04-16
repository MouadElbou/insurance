import fp from "fastify-plugin";
import type { FastifyInstance, FastifyError } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { config } from "../config.js";

export default fp(
  async function errorHandlerPlugin(fastify: FastifyInstance) {
    fastify.setErrorHandler((error: FastifyError | Error, request, reply) => {
      request.log.error(
        {
          err: error,
          url: request.url,
          method: request.method,
          requestId: request.id,
        },
        "Request error",
      );

      // Zod validation error
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Donnees de requete invalides.",
            details: error.errors.map((e) => ({
              path: e.path.join("."),
              message: e.message,
            })),
          },
        });
      }

      // Prisma known request errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint violation
        if (error.code === "P2002") {
          const target = (error.meta?.target as string[])?.join(", ") ?? "champ";
          return reply.code(409).send({
            success: false,
            error: {
              code: "DUPLICATE_ENTRY",
              message: `Un enregistrement avec ce ${target} existe deja.`,
            },
          });
        }

        // Record not found
        if (error.code === "P2025") {
          return reply.code(404).send({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Ressource introuvable.",
            },
          });
        }
      }

      // Extract statusCode from Fastify errors or application errors
      const statusCode =
        "statusCode" in error
          ? ((error as FastifyError).statusCode ?? 500)
          : 500;

      // Rate limit error from @fastify/rate-limit
      if (statusCode === 429) {
        return reply.code(429).send({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Trop de requetes. Veuillez reessayer plus tard.",
          },
        });
      }

      // Application errors with explicit statusCode + code (e.g., auth service errors)
      const errRecord = error as unknown as Record<string, unknown>;
      const appCode =
        "code" in error && typeof errRecord.code === "string"
          ? errRecord.code
          : undefined;

      if (statusCode >= 400 && statusCode < 500 && appCode) {
        return reply.code(statusCode).send({
          success: false,
          error: {
            code: appCode,
            message: error.message,
          },
        });
      }

      // Generic error — no internal details in production
      const message =
        config.NODE_ENV === "production"
          ? "Erreur interne du serveur."
          : error.message;

      return reply.code(statusCode >= 400 ? statusCode : 500).send({
        success: false,
        error: {
          code: appCode ?? "INTERNAL_ERROR",
          message,
          ...(config.NODE_ENV !== "production" && { details: error.stack }),
        },
      });
    });
  },
  { name: "error-handler" },
);
