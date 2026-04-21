/**
 * Zod schemas for scraper ingestion endpoints.
 * @see .workflow/phases/scraper-architect/architecture.md §Zod Schemas
 */
import { z } from "zod";
import { isSafeRegexSource } from "../utils/regex-safety.js";

/** Individual captured HTTP exchange. */
export const scraperEventInputSchema = z.object({
  method: z.string().min(1).max(10),
  url: z.string().url().max(2048),
  host: z.string().min(1).max(255),
  pathname: z.string().max(2048),
  status_code: z.number().int().nullable(),
  request_headers: z.record(z.string(), z.string()).nullable(),
  response_headers: z.record(z.string(), z.string()).nullable(),
  request_body: z.string().max(500_000).nullable(),
  response_body: z.string().max(1_500_000).nullable(),
  captured_at: z.string().datetime(),
  duration_ms: z.number().int().min(0).nullable(),
});

/** Body posted to POST /api/v1/scraper/events. */
export const scraperBatchRequestSchema = z.object({
  batch_id: z.string().uuid(),
  events: z.array(scraperEventInputSchema).min(1).max(50),
});

/** Query string for GET /api/v1/scraper/events. */
export const scraperEventsQuerySchema = z.object({
  employee_id: z.string().uuid().optional(),
  host: z.string().optional(),
  insurer_code: z.string().optional(),
  verdict: z.enum(["pending", "transformed", "ignored", "error"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
});

/** Body for POST/PUT /api/v1/insurer-domains. */
export const insurerDomainInputSchema = z.object({
  host_pattern: z
    .string()
    .min(1)
    .max(255)
    // Two-layer defense: (1) reject ReDoS-prone shapes statically,
    // (2) make sure the engine can actually compile it. Both are
    // required — either alone leaves a gap.
    // See `packages/shared/src/utils/regex-safety.ts` for the static
    // analyzer's rejection criteria.
    .refine(isSafeRegexSource, {
      message:
        "Expression régulière non sûre (risque de déni de service). Utilisez des motifs ancrés comme ^www\\.exemple\\.com$.",
    })
    .refine((p) => {
      try {
        // Host matching always uses the `i` flag, so validate with it.
        new RegExp(p, "i");
        return true;
      } catch {
        return false;
      }
    }, "Regex invalide"),
  insurer_code: z
    .string()
    .regex(
      /^[A-Z0-9_]{2,16}$/,
      "Code invalide (A-Z, 0-9, _, 2-16 caractères)",
    ),
  label: z.string().min(1).max(100),
  capture_enabled: z.boolean(),
});

/**
 * Server-issued allowlist entry shipped to the Electron main process.
 * Used by F4 (main-side fetch) so the renderer never dictates what's in
 * the allowlist — main validates the server response against this schema
 * before handing it to `PortalManager.setAllowlist`.
 */
export const insurerDomainAllowlistEntrySchema = insurerDomainInputSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
});

export type ScraperEventInputInput = z.input<typeof scraperEventInputSchema>;
export type ScraperBatchRequestInput = z.input<typeof scraperBatchRequestSchema>;
export type ScraperEventsQueryInput = z.input<typeof scraperEventsQuerySchema>;
export type InsurerDomainInputInput = z.input<typeof insurerDomainInputSchema>;
export type InsurerDomainAllowlistEntry = z.infer<
  typeof insurerDomainAllowlistEntrySchema
>;
