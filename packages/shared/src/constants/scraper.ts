/**
 * Scraper ingestion constants
 * @see .workflow/phases/scraper-architect/architecture.md
 */

/**
 * Header names (lowercase) that MUST be stripped before persisting or transmitting
 * scraper events. Any header starting with `x-auth` is also dropped (see SCRAPER_HEADER_DROP_PREFIX).
 */
export const SCRAPER_HEADER_DROP_LIST: ReadonlySet<string> = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-auth-token",
  "x-csrf-token",
  "x-api-key",
  "x-access-token",
  "x-session-id",
  "x-session-token",
]);

/** Regex prefix — any header matching this is also dropped. */
export const SCRAPER_HEADER_DROP_PREFIX = /^x-auth/i;

/**
 * URL pattern matching login/auth endpoints. When the URL matches, the request
 * body is replaced with `"[REDACTED]"` even before the event is batched.
 */
export const SCRAPER_LOGIN_URL_PATTERN = /(login|signin|auth)/i;

/** Maximum events per HTTP batch to the backend (enforced by Zod on backend). */
export const SCRAPER_MAX_BATCH_SIZE = 50;

/** Alias kept for backend config clarity. */
export const SCRAPER_MAX_BATCH = SCRAPER_MAX_BATCH_SIZE;

/** Wall-clock interval for flushing the in-memory buffer (ms). */
export const SCRAPER_FLUSH_INTERVAL_MS = 5_000;

/** Threshold at which the in-memory buffer flushes immediately. */
export const SCRAPER_BUFFER_THRESHOLD = 20;

/** Request body hard cap (bytes of JSON-stringified body). */
export const SCRAPER_MAX_REQUEST_BODY_BYTES = 500_000;

/** Response body hard cap (bytes of JSON-stringified body). */
export const SCRAPER_MAX_RESPONSE_BODY_BYTES = 1_500_000;

/** Fastify `bodyLimit` for the scraper batch endpoint (2 MB). */
export const SCRAPER_MAX_BODY_BYTES = 2 * 1024 * 1024;

/** Default retention window for raw `ScraperEvent` rows. */
export const SCRAPER_RETENTION_DAYS = 180;

/** Transformer verdict values (aligned with Prisma enum). */
export const TRANSFORMER_VERDICTS = {
  PENDING: "PENDING",
  TRANSFORMED: "TRANSFORMED",
  IGNORED: "IGNORED",
  ERROR: "ERROR",
} as const;

/** Client-side capture status values exposed through the IPC bridge. */
export const CAPTURE_STATUSES = {
  IDLE: "IDLE",
  OPENING: "OPENING",
  OPEN: "OPEN",
  CAPTURING: "CAPTURING",
  CLOSED: "CLOSED",
  ERROR: "ERROR",
} as const;

/** Retry schedule for batch flush failures (milliseconds). */
export const SCRAPER_RETRY_BACKOFF_MS: ReadonlyArray<number> = [1_000, 5_000, 30_000];

/** Session partition string used by the portal WebContentsView. */
export const PORTAL_SESSION_PARTITION = "persist:insurer-portals";

/** Default seed host patterns for the insurer allowlist. */
export const DEFAULT_INSURER_SEEDS: ReadonlyArray<{
  host_pattern: string;
  insurer_code: string;
  label: string;
}> = [
  {
    host_pattern: "^(www\\.)?rmaassurance\\.com$",
    insurer_code: "RMA",
    label: "RMA Assurance",
  },
  {
    host_pattern: "^portail\\.rmaassurance\\.com$",
    insurer_code: "RMA",
    label: "RMA Portail Courtier",
  },
  {
    host_pattern: "^gama\\.rmaassurance\\.com$",
    insurer_code: "RMA",
    label: "RMA Gama",
  },
  {
    host_pattern: "^rmastore\\.rmaassurance\\.com$",
    insurer_code: "RMA",
    label: "RMA Store",
  },
  {
    host_pattern: "^autoflotte-sy\\.rmawatanya\\.com$",
    insurer_code: "RMA_WATANYA",
    label: "RMA Watanya — Auto Flotte",
  },
  {
    host_pattern: "^automono-sy\\.rmawatanya\\.com$",
    insurer_code: "RMA_WATANYA",
    label: "RMA Watanya — Auto Mono",
  },
  {
    host_pattern: "^vega\\.rmaassistance\\.com$",
    insurer_code: "RMA_ASSISTANCE",
    label: "RMA Assistance — Vega",
  },
  {
    host_pattern: "^tpv2\\.cat\\.co\\.ma:4439$",
    insurer_code: "CAT",
    label: "CAT Assurances — TPV2",
  },
];
