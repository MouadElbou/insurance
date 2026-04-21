/**
 * Transformer contract — converts raw ScraperEvent rows into zero or more
 * ParsedOperation records plus a per-event verdict annotation.
 *
 * One transformer corresponds to one insurer. The transformer registry
 * routes events to the appropriate transformer by matching `hostPattern`
 * against the event's `host` field.
 *
 * Transformers MUST NOT mutate the input events and MUST be side-effect free
 * (no DB writes, no network, no emitters). The caller (scraper service) is
 * responsible for persistence and Socket.IO emission.
 */
import type { TransformerVerdict } from "@insurance/shared";
import type { ParsedOperation } from "../adapter.interface.js";

/**
 * Minimal ScraperEvent shape passed to transformers. We keep this
 * decoupled from the Prisma model so transformers can be unit-tested
 * without a DB client in scope.
 */
export interface TransformerInputEvent {
  id: string;
  employee_id: string;
  insurer_code: string | null;
  host: string;
  url: string;
  pathname: string;
  method: string;
  status_code: number | null;
  request_headers: Record<string, string> | null;
  request_body: string | null;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  captured_at: Date;
}

/**
 * Context passed to each transformer invocation. Kept intentionally small —
 * transformers must stay pure and read-only.
 */
export interface TransformerContext {
  /** Operator code of the employee who captured the events (for attribution). */
  operatorCode: string;
}

/**
 * Per-event verdict annotation returned alongside any ParsedOperation output.
 * The scraper service persists these back onto each `ScraperEvent` row.
 */
export interface TransformerVerdictAnnotation {
  event_id: string;
  verdict: TransformerVerdict;
  /** Human-readable note; surfaced in the ops dashboard for debugging. */
  notes?: string;
  /** Optional operation dedup keys this event produced (for audit trail). */
  operation_keys?: Array<{
    type: "PRODUCTION" | "EMISSION";
    policy_number: string;
    avenant_number?: string;
    quittance_number?: string;
  }>;
}

/**
 * Result returned by a transformer for a group of events belonging to one host.
 */
export interface TransformerResult {
  operations: ParsedOperation[];
  verdicts: TransformerVerdictAnnotation[];
}

export interface Transformer {
  /** Stable insurer code, e.g., "RMA". Matches `InsurerDomain.insurer_code`. */
  readonly insurer_code: string;
  /**
   * Single regex matching host names this transformer handles.
   * The registry picks the first transformer whose `hostPattern.test(host)` returns true.
   */
  readonly hostPattern: RegExp;
  /**
   * Transform a batch of events captured on the same host into operations + verdicts.
   * MUST be pure (no IO, no mutation). Errors MUST be surfaced as ERROR verdicts,
   * not thrown — a single bad event must not abort the whole batch.
   */
  transform(
    events: TransformerInputEvent[],
    context: TransformerContext,
  ): Promise<TransformerResult>;
}
