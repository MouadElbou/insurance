/**
 * Scraper ingestion types
 * @see .workflow/phases/scraper-architect/architecture.md §Shared Types
 */

/**
 * Final state of a ScraperEvent after transformer(s) have processed it.
 * Mirrors the Prisma enum TransformerVerdict.
 */
export type TransformerVerdict =
  | "PENDING"
  | "TRANSFORMED"
  | "IGNORED"
  | "ERROR";

/**
 * A single captured HTTP exchange as seen in the Electron main process.
 * Sent from renderer -> main -> backend in batches.
 */
export interface ScraperEventInput {
  method: string;
  url: string;
  host: string;
  pathname: string;
  status_code: number | null;
  request_headers: Record<string, string> | null;
  response_headers: Record<string, string> | null;
  request_body: string | null;
  response_body: string | null;
  /** ISO-8601 UTC timestamp. */
  captured_at: string;
  duration_ms: number | null;
}

/**
 * Request body posted to POST /api/v1/scraper/events.
 * The backend enforces batch_id uniqueness to avoid replay on retry.
 */
export interface ScraperBatchRequest {
  batch_id: string;
  events: ScraperEventInput[];
}

/**
 * Response body returned by POST /api/v1/scraper/events.
 */
export interface ScraperBatchResponse {
  accepted: number;
  rejected: number;
  rejected_reasons: Array<{ index: number; reason: string }>;
  emitted_operations: number;
  batch_id: string;
}

/**
 * List-item shape returned by GET /api/v1/scraper/events (paginated).
 */
export interface ScraperEventListItem {
  id: string;
  employee_id: string;
  employee: {
    full_name: string;
    operator_code: string;
  };
  method: string;
  url: string;
  host: string;
  pathname: string;
  status_code: number | null;
  captured_at: string;
  duration_ms: number | null;
  processed_at: string | null;
  transformer_verdict: TransformerVerdict;
  /**
   * Transformer notes emitted alongside the verdict. Non-null only when the
   * row has been processed (verdict ∈ { TRANSFORMED | IGNORED | ERROR }) and
   * the transformer chose to attach a human-readable message — error text for
   * ERROR verdicts, a "no transformer matched" explanation for IGNORED, or
   * `null` for a clean TRANSFORMED. Field name mirrors the DB column
   * `scraper_event.transformer_notes`.
   */
  transformer_notes: string | null;
  operation_ids: string[];
  insurer_code: string | null;
}

/**
 * Detail view returned by GET /api/v1/scraper/events/:id.
 * Includes redacted request/response bodies.
 */
export interface ScraperEventDetail extends ScraperEventListItem {
  request_headers: Record<string, string> | null;
  response_headers: Record<string, string> | null;
  request_body: string | null;
  response_body: string | null;
}

/**
 * Insurer allowlist entry. Admin-editable at `/insurer-domains`.
 */
export interface InsurerDomain {
  id: string;
  host_pattern: string;
  insurer_code: string;
  label: string;
  capture_enabled: boolean;
  created_at: string;
}

/**
 * Payload for POST/PUT /api/v1/insurer-domains (and form state).
 */
export interface InsurerDomainInput {
  host_pattern: string;
  insurer_code: string;
  label: string;
  capture_enabled: boolean;
}

/**
 * Client-side capture status exposed through the IPC bridge.
 */
export type CaptureStatus =
  | "IDLE"
  | "OPENING"
  | "OPEN"
  | "CAPTURING"
  | "CLOSED"
  | "ERROR";

/**
 * Status event pushed from the main process to the renderer through the scraperAPI bridge.
 */
export interface PortalStatus {
  status: CaptureStatus;
  insurer_code: string | null;
  url: string | null;
  captured_count: number;
  last_flush_at: string | null;
  last_error: string | null;
}

/**
 * Summary returned by GET /api/v1/scraper/events/stats?employee_id=...
 * Powers the PortalToolbar "events captured today" badge.
 */
export interface ScraperEventStats {
  captured_today: number;
  transformed_today: number;
  errors_today: number;
  last_captured_at: string | null;
}

/**
 * Filters accepted by useScraperEvents / scraperApi.listEvents.
 */
export interface ScraperEventsQuery {
  employee_id?: string;
  host?: string;
  insurer_code?: string;
  verdict?: "pending" | "transformed" | "ignored" | "error";
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  page_size?: number;
}
