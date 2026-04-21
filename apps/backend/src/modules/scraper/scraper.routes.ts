/**
 * Fastify route module for the scraper ingestion API.
 *
 * Mounted under `/api/v1/scraper` (see app.ts). All routes require
 * authentication — the module-level `preHandler` hook installs it once. A few
 * routes require MANAGER role (replay, domain CRUD) via a per-route
 * `authorize("MANAGER")` preHandler.
 *
 * Validation is per-route: we use the shared Zod schemas from
 * `@insurance/shared`. POST /events additionally carries a per-route bodyLimit
 * (larger than the app default) so captured response bodies fit, and a strict
 * per-route rate limit to protect the ingest path from a runaway extension.
 */
import type { FastifyInstance } from "fastify";
import type { InsurerDomainInput } from "@insurance/shared";
import {
  SCRAPER_MAX_BODY_BYTES,
  insurerDomainInputSchema,
  scraperBatchRequestSchema,
  scraperEventsQuerySchema,
} from "@insurance/shared";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createDomainHandler,
  deleteDomainHandler,
  getEventHandler,
  ingestHandler,
  listDomainsHandler,
  listEventsHandler,
  replayEventHandler,
  statsHandler,
  updateDomainHandler,
} from "./scraper.handler.js";

export default async function scraperRoutes(fastify: FastifyInstance) {
  // All scraper routes require an authenticated user.
  fastify.addHook("preHandler", authenticate);

  // ─── POST /events ────────────────────────────────────────────────────
  //
  // Ingest a batch of captured HTTP events. Heavier per-route limits:
  //   • bodyLimit — raw response bodies are capped at 1.5 MB by the schema,
  //     but one batch may carry up to 50 events. We allow up to 2 MB of
  //     wire payload (SCRAPER_MAX_BODY_BYTES) to cover headers + overhead.
  //   • rateLimit — 120 requests/minute per subject. The extension batches
  //     every few seconds, so this is ~2 batches/sec, comfortably above
  //     normal. Keying on the JWT `sub` (not `req.ip`) so that employees
  //     behind a shared NAT gateway don't collapse into one bucket and
  //     starve each other — see feedback-iteration-1 B4. We fall back to
  //     `req.ip` only if `req.user` hasn't been populated yet (shouldn't
  //     happen because `authenticate` runs in preHandler, but defensive).
  fastify.post("/events", {
    bodyLimit: SCRAPER_MAX_BODY_BYTES,
    config: {
      rateLimit: {
        max: 120,
        timeWindow: "1 minute",
        keyGenerator: (req) => {
          const sub = (req.user as { sub?: string } | undefined)?.sub;
          return sub ? `sub:${sub}` : `ip:${req.ip}`;
        },
      },
    },
    preHandler: [validate(scraperBatchRequestSchema)],
    handler: ingestHandler,
  });

  // ─── GET /events ─────────────────────────────────────────────────────
  fastify.get("/events", {
    preHandler: [validate(scraperEventsQuerySchema, "querystring")],
    handler: listEventsHandler,
  });

  // ─── GET /events/stats ───────────────────────────────────────────────
  //
  // EMPLOYEE role is automatically scoped to own stats inside the handler.
  // MANAGER may pass ?employee_id=<uuid> to scope, or omit for global.
  fastify.get("/events/stats", {
    handler: statsHandler,
  });

  // ─── GET /events/:id ─────────────────────────────────────────────────
  //
  // Service enforces RBAC (EMPLOYEE can only see own events) so we do not
  // gate at the route layer.
  fastify.get<{ Params: { id: string } }>("/events/:id", {
    handler: getEventHandler,
  });

  // ─── POST /events/:id/replay ─────────────────────────────────────────
  //
  // MANAGER only — re-run the transformer on a persisted event after a
  // transformer bugfix.
  fastify.post<{ Params: { id: string } }>("/events/:id/replay", {
    preHandler: [authorize("MANAGER")],
    handler: replayEventHandler,
  });

  // ─── GET /insurer-domains ────────────────────────────────────────────
  fastify.get("/insurer-domains", {
    handler: listDomainsHandler,
  });

  // ─── POST /insurer-domains ───────────────────────────────────────────
  fastify.post("/insurer-domains", {
    preHandler: [
      authorize("MANAGER"),
      validate(insurerDomainInputSchema),
    ],
    handler: createDomainHandler,
  });

  // ─── PUT /insurer-domains/:id ────────────────────────────────────────
  fastify.put<{ Params: { id: string }; Body: InsurerDomainInput }>(
    "/insurer-domains/:id",
    {
      preHandler: [authorize("MANAGER"), validate(insurerDomainInputSchema)],
      handler: updateDomainHandler,
    },
  );

  // ─── DELETE /insurer-domains/:id ─────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>("/insurer-domains/:id", {
    preHandler: [authorize("MANAGER")],
    handler: deleteDomainHandler,
  });
}
