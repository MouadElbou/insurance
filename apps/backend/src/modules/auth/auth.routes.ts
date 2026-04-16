import type { FastifyInstance } from "fastify";
import { loginSchema, refreshSchema } from "@insurance/shared";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { meHandler, loginHandler, refreshHandler, logoutHandler } from "./auth.handler.js";

export default async function authRoutes(fastify: FastifyInstance) {
  // GET /me — requires auth, returns current user profile
  fastify.get("/me", {
    preHandler: [authenticate],
    handler: meHandler,
  });

  // POST /login — no auth, rate limited
  fastify.post("/login", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute",
      },
    },
    preHandler: [validate(loginSchema)],
    handler: loginHandler,
  });

  // POST /refresh — no auth, rate limited
  fastify.post("/refresh", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
      },
    },
    preHandler: [validate(refreshSchema)],
    handler: refreshHandler,
  });

  // POST /logout — requires auth + refresh_token in body
  fastify.post("/logout", {
    preHandler: [authenticate, validate(refreshSchema)],
    handler: logoutHandler,
  });
}
