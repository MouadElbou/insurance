/**
 * Scraper ingestion service — orchestrates:
 *
 *   1. Insurer-domain allowlist matching (host regex compiled from DB).
 *   2. Header sanitization + body redaction (strip auth, redact login bodies).
 *   3. ScraperEvent persistence (PENDING verdict initially).
 *   4. Transformer fan-out via ScraperAdapter.
 *   5. Verdict write-back onto each event row (processed_at + notes).
 *   6. Operation dedup/upsert + Socket.IO emission to the dashboard room.
 *
 * No Redis/workers per architectural constraint — everything happens in-process
 * inside the POST /events handler.
 *
 * NEVER logs or persists secret headers. `authorization`, `cookie`, `set-cookie`,
 * `x-api-key`, etc. are stripped BEFORE the event row is written. Login URL
 * bodies are replaced with `"[REDACTED]"` the same way.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import type { Server } from "socket.io";
import {
  SCRAPER_HEADER_DROP_LIST,
  SCRAPER_HEADER_DROP_PREFIX,
  SCRAPER_LOGIN_URL_PATTERN,
  SOCKET_EVENTS,
  analyzeRegexSafety,
  type ClientToServerEvents,
  type InsurerDomain as InsurerDomainDto,
  type InsurerDomainInput,
  type Role,
  type ScraperBatchRequest,
  type ScraperBatchResponse,
  type ScraperEventDetail,
  type ScraperEventListItem,
  type ScraperEventStats,
  type ScraperEventsQuery,
  type ServerToClientEvents,
  type TransformerVerdict,
} from "@insurance/shared";
import { adapterRegistry } from "../../ingestion/adapter.registry.js";
import type { ScraperAdapterInput } from "../../ingestion/adapters/scraper.adapter.js";
import type {
  TransformerInputEvent,
  TransformerVerdictAnnotation,
} from "../../ingestion/transformers/transformer.interface.js";
import type { ParsedOperation } from "../../ingestion/adapter.interface.js";
import { dedupAndPersist } from "../../ingestion/dedup.service.js";
import { logger } from "../../utils/logger.js";
import { sanitizeOptional } from "../../utils/sanitize.js";

// ─── Types ────────────────────────────────────────────────────────────

type ScraperIo = Server<ClientToServerEvents, ServerToClientEvents>;

interface DomainMatch {
  id: string;
  insurer_code: string;
  host_pattern: string;
  regex: RegExp;
}

interface RequestUser {
  sub: string;
  role: Role;
  operator_code: string;
}

// ─── In-memory batch_id idempotency (LRU) ─────────────────────────────
//
// Single-node deployment (per constraints). Size chosen so ~5 min of peak
// traffic (20 batches/min) fits comfortably. Eviction is FIFO via Map
// insertion order, which is sufficient since we only need "seen recently"
// semantics, not strict LRU.
const BATCH_ID_CAPACITY = 512;
const seenBatchIds: Map<string, number> = new Map();

function rememberBatchId(batchId: string): void {
  // Refresh position: delete+set moves key to newest slot.
  seenBatchIds.delete(batchId);
  seenBatchIds.set(batchId, Date.now());
  while (seenBatchIds.size > BATCH_ID_CAPACITY) {
    const oldest = seenBatchIds.keys().next().value;
    if (!oldest) break;
    seenBatchIds.delete(oldest);
  }
}

function wasBatchIdSeen(batchId: string): boolean {
  return seenBatchIds.has(batchId);
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Strip sensitive headers before persistence. Match is lowercase-insensitive.
 * Returns `null` if input is null (keeps column null).
 */
function sanitizeHeaders(
  headers: Record<string, string> | null,
): Record<string, string> | null {
  if (!headers) return null;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (SCRAPER_HEADER_DROP_LIST.has(lower)) continue;
    if (SCRAPER_HEADER_DROP_PREFIX.test(lower)) continue;
    out[name] = value;
  }
  return out;
}

/**
 * Redact request body for login/auth URLs. Response bodies are never redacted
 * here because they may contain the transformer payload we need to parse.
 */
function redactRequestBody(url: string, body: string | null): string | null {
  if (!body) return null;
  if (SCRAPER_LOGIN_URL_PATTERN.test(url)) return "[REDACTED]";
  return body;
}

/**
 * Case-maps the shared (lowercase) verdict filter to the Prisma enum value.
 */
function mapVerdictFilter(
  value: "pending" | "transformed" | "ignored" | "error" | undefined,
): TransformerVerdict | undefined {
  if (!value) return undefined;
  return value.toUpperCase() as TransformerVerdict;
}

/**
 * Compiled-regex cache for insurer-domain rows.
 *
 * Keyed by `InsurerDomain.id`. Each entry records the last `updated_at` we
 * compiled against so we can invalidate on row edits without a full reload.
 *
 * Rationale: allowlist rarely changes, but the ingest path runs this on
 * every batch. Recompiling every time wastes CPU and, more importantly, re-
 * runs the safety analyzer on untrusted DB content in a hot path. Caching
 * by (id, updated_at) is correct because `updated_at` is bumped on every
 * Prisma update (via `@updatedAt`).
 *
 * The cache is bounded implicitly by the size of the allowlist (typically
 * < 50 rows in production), so no eviction logic is needed.
 */
const compiledDomainCache: Map<
  string,
  { updated_at: Date; entry: DomainMatch }
> = new Map();

/**
 * Load + compile the enabled allowlist entries into a prioritized list of
 * regexes. Disabled rows are filtered out.
 *
 * Defense in depth for ReDoS (B1/B3):
 *   • Write-time (Zod schema) already rejects unsafe patterns — but rows
 *     inserted before the guard existed, or out-of-band DB edits, could
 *     still leave a bad pattern in `insurer_domain.host_pattern`.
 *   • At load-time we run `analyzeRegexSafety` against every row and skip
 *     any that fail. Skipped rows are logged with structured context so
 *     operators can see them and fix them. The batch is NOT 500'd.
 *   • Compiled regexes are cached by id+updated_at so the static analyzer
 *     doesn't run on every request.
 */
async function loadEnabledDomains(prisma: PrismaClient): Promise<DomainMatch[]> {
  const rows = await prisma.insurerDomain.findMany({
    where: { capture_enabled: true },
    orderBy: { created_at: "asc" },
  });

  const out: DomainMatch[] = [];
  const seenIds = new Set<string>();

  for (const row of rows) {
    seenIds.add(row.id);
    const cached = compiledDomainCache.get(row.id);
    if (cached && cached.updated_at.getTime() === row.updated_at.getTime()) {
      // Pattern text hasn't changed since we compiled it — reuse.
      // Guard against host_pattern drift: updated_at is the authoritative
      // signal in Prisma, but double-check the source string equality just
      // in case a migration backfilled updated_at without bumping content
      // (paranoid, but cheap).
      if (cached.entry.host_pattern === row.host_pattern) {
        out.push(cached.entry);
        continue;
      }
    }

    // Static ReDoS analysis — refuse to even compile unsafe patterns.
    const verdict = analyzeRegexSafety(row.host_pattern);
    if (!verdict.safe) {
      logger.warn(
        {
          host_pattern: row.host_pattern,
          id: row.id,
          insurer_code: row.insurer_code,
          reason: verdict.reason,
        },
        "InsurerDomain host_pattern rejected by safety analyzer — skipping",
      );
      compiledDomainCache.delete(row.id);
      continue;
    }

    let regex: RegExp;
    try {
      regex = new RegExp(row.host_pattern, "i");
    } catch (err) {
      logger.warn(
        {
          err,
          host_pattern: row.host_pattern,
          id: row.id,
          insurer_code: row.insurer_code,
        },
        "InsurerDomain regex failed to compile — skipping",
      );
      compiledDomainCache.delete(row.id);
      continue;
    }

    const entry: DomainMatch = {
      id: row.id,
      insurer_code: row.insurer_code,
      host_pattern: row.host_pattern,
      regex,
    };
    compiledDomainCache.set(row.id, { updated_at: row.updated_at, entry });
    out.push(entry);
  }

  // Evict cache entries for rows that have been deleted or disabled.
  for (const cachedId of compiledDomainCache.keys()) {
    if (!seenIds.has(cachedId)) compiledDomainCache.delete(cachedId);
  }

  return out;
}

/**
 * Test-only helper — clears the compiled-domain cache so tests that seed
 * new InsurerDomain rows don't see stale entries from a prior test run.
 * Not exported on the production code path.
 */
export function __resetInsurerDomainCacheForTests(): void {
  compiledDomainCache.clear();
}

function findDomainMatch(host: string, domains: DomainMatch[]): DomainMatch | null {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return null;
  for (const d of domains) {
    if (d.regex.test(normalized)) return d;
  }
  return null;
}

/**
 * Extract pathname from a URL string; returns `""` on parse failure. We
 * accept invalid URLs in the pathname column because the scraper may
 * capture pre-flight OPTIONS that come through as fragments.
 */
function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

// ─── Dedup + response mapping helpers ────────────────────────────────

/**
 * Composite dedup key for `Operation`. Used by both the emit-dedup logic and
 * the `uq_operation_dedup` unique constraint. Nullable components (avenant,
 * quittance) are normalized to `null` — NEVER `""` — so the lookup matches
 * Postgres' NULL semantics and the CREATE path in `dedupAndPersist`.
 *
 * See feedback-iteration-1 B5: previously this used `?? ""`, which made
 * Prisma emit `col = ''` instead of `col IS NULL`, so the existingKeys Set
 * never matched already-persisted NULL rows and every re-ingest flagged
 * them as "new" — causing duplicate Socket.IO `operation:new` emits.
 */
interface OperationDedupKey {
  type: Prisma.OperationGetPayload<{}>["type"];
  policy_number: string;
  avenant_number: string | null;
  quittance_number: string | null;
}

function normalizeDedupKey(k: {
  type: Prisma.OperationGetPayload<{}>["type"];
  policy_number: string;
  avenant_number: string | null | undefined;
  quittance_number: string | null | undefined;
}): OperationDedupKey {
  return {
    type: k.type,
    policy_number: k.policy_number,
    // Intentionally `?? null`, NOT `?? ""` — see comment above.
    avenant_number: k.avenant_number ?? null,
    quittance_number: k.quittance_number ?? null,
  };
}

/**
 * String-serialise a dedup key for Set membership. NULL components must be
 * stringified as the literal token `\0` (NUL) to avoid colliding with rows
 * whose string value happens to be empty. Without this, a row with
 * `avenant_number = null` and one with `avenant_number = ""` would hash to
 * the same key.
 */
function hashDedupKey(k: OperationDedupKey): string {
  return [
    k.type,
    k.policy_number,
    k.avenant_number ?? "\u0000",
    k.quittance_number ?? "\u0000",
  ].join("|");
}

/**
 * Find the set of dedup keys already present in `Operation` for a given list.
 * Returns a Set of hashed keys so callers can test membership cheaply.
 *
 * We issue a single `findMany` with an OR across all keys rather than N
 * round trips, then project only the columns that make up the composite
 * key.
 *
 * IMPORTANT: the WHERE clause uses `null` — not `""` — for optional columns
 * so Prisma emits `IS NULL` and matches rows written via the CREATE path.
 */
async function existingOperationDedupKeys(
  prisma: PrismaClient,
  keys: OperationDedupKey[],
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const existingRows = await prisma.operation.findMany({
    where: {
      OR: keys.map((k) => ({
        type: k.type,
        policy_number: k.policy_number,
        avenant_number: k.avenant_number,
        quittance_number: k.quittance_number,
      })),
    },
    select: {
      type: true,
      policy_number: true,
      avenant_number: true,
      quittance_number: true,
    },
  });
  return new Set(
    existingRows.map((r) =>
      hashDedupKey({
        type: r.type,
        policy_number: r.policy_number,
        avenant_number: r.avenant_number,
        quittance_number: r.quittance_number,
      }),
    ),
  );
}

/**
 * Centralised mapper: Prisma row -> shared `ScraperEventListItem`.
 *
 * Used by both listEvents and getEvent so the DTO stays consistent. Keeping
 * this single source of truth also makes the field-name contract with the
 * frontend explicit — see feedback-iteration-1 B7 (field was `transformer_error`
 * but DB column is `transformer_notes`; the mapper now exposes the notes
 * under its real name whenever they exist, not just for ERROR verdicts).
 */
type ScraperEventRowWithEmployee = Prisma.ScraperEventGetPayload<{
  include: { employee: { select: { full_name: true; operator_code: true } } };
}>;

function toScraperEventListItem(
  row: ScraperEventRowWithEmployee,
): ScraperEventListItem {
  return {
    id: row.id,
    employee_id: row.employee_id,
    employee: {
      full_name: row.employee?.full_name ?? "",
      operator_code: row.employee?.operator_code ?? "",
    },
    method: row.method,
    url: row.url,
    host: row.host,
    pathname: safePathname(row.url),
    status_code: row.status_code,
    captured_at: row.captured_at.toISOString(),
    // duration_ms not stored on the row — returned null per contract.
    duration_ms: null,
    processed_at: row.processed_at?.toISOString() ?? null,
    transformer_verdict: row.transformer_verdict,
    // Expose the DB column under its real name. Previously this was exposed
    // as `transformer_error` and scoped to ERROR verdicts only — that lost
    // the IGNORED notes ("no transformer matched") which the drawer also
    // wants to show, and diverged from the Prisma schema.
    transformer_notes: row.transformer_notes,
    // operation_ids not tracked via DB backlink — empty list for now.
    // A future migration could add ScraperEventOperation if UX demands it.
    operation_ids: [],
    insurer_code: row.insurer_code,
  };
}

// Build the ActivityItem payload emitted on Socket.IO for a freshly-created
// operation. Matches the shape used by operations.handler.ts.
function toActivityItem(
  row: Prisma.OperationGetPayload<{ include: { employee: { select: { full_name: true } } } }>,
): {
  id: string;
  employee_name: string;
  employee_id: string;
  operation_type: Prisma.OperationGetPayload<{}>["type"];
  source: Prisma.OperationGetPayload<{}>["source"];
  policy_number: string;
  client_name: string | null;
  prime_net: string | null;
  created_at: string;
} {
  return {
    id: row.id,
    employee_name: row.employee?.full_name ?? "",
    employee_id: row.employee_id,
    operation_type: row.type,
    source: row.source,
    policy_number: row.policy_number,
    client_name: row.client_name,
    prime_net: row.prime_net?.toString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

// ─── ingestEvents ─────────────────────────────────────────────────────

/**
 * Ingest a validated batch of captured events.
 *
 *   - Rejects events whose host is not in the enabled allowlist (not a 4xx
 *     on the batch — per-event, surfaced in `rejected_reasons`).
 *   - Sanitizes headers + redacts login bodies BEFORE persisting.
 *   - Inserts all accepted events in a single `createMany` for throughput,
 *     then `findMany` to get their IDs for the adapter + verdict write-back.
 *   - Runs the ScraperAdapter, persists verdicts, dedups + upserts operations,
 *     and emits `operation:new` for each new row.
 *   - Idempotent via `batch_id` — a repeat of the same UUID within the LRU
 *     window returns a zero-impact response instead of re-processing.
 */
export async function ingestEvents(
  prisma: PrismaClient,
  io: ScraperIo,
  batch: ScraperBatchRequest,
  user: RequestUser,
): Promise<ScraperBatchResponse> {
  // Idempotency short-circuit.
  if (wasBatchIdSeen(batch.batch_id)) {
    logger.info(
      { batch_id: batch.batch_id, employee_id: user.sub },
      "Duplicate scraper batch — skipping",
    );
    return {
      accepted: 0,
      rejected: 0,
      rejected_reasons: [],
      emitted_operations: 0,
      batch_id: batch.batch_id,
    };
  }

  const domains = await loadEnabledDomains(prisma);

  const rejected_reasons: Array<{ index: number; reason: string }> = [];
  type StagedEvent = {
    index: number;
    insurer_code: string;
    data: Prisma.ScraperEventCreateManyInput;
  };
  const staged: StagedEvent[] = [];

  // Phase 1: match allowlist + sanitize.
  batch.events.forEach((event, index) => {
    const match = findDomainMatch(event.host, domains);
    if (!match) {
      rejected_reasons.push({
        index,
        reason: `Hôte non autorisé: ${event.host}`,
      });
      return;
    }

    const cleanedRequestHeaders = sanitizeHeaders(event.request_headers);
    const cleanedResponseHeaders = sanitizeHeaders(event.response_headers);
    const cleanedRequestBody = redactRequestBody(event.url, event.request_body);

    staged.push({
      index,
      insurer_code: match.insurer_code,
      data: {
        employee_id: user.sub,
        insurer_code: match.insurer_code,
        host: event.host.toLowerCase(),
        url: event.url,
        method: event.method.toUpperCase(),
        status_code: event.status_code,
        request_headers:
          cleanedRequestHeaders as Prisma.ScraperEventCreateManyInput["request_headers"],
        request_body: cleanedRequestBody,
        response_headers:
          cleanedResponseHeaders as Prisma.ScraperEventCreateManyInput["response_headers"],
        response_body: event.response_body,
        captured_at: new Date(event.captured_at),
        // transformer_verdict defaults to PENDING via schema.
      },
    });
  });

  if (staged.length === 0) {
    rememberBatchId(batch.batch_id);
    return {
      accepted: 0,
      rejected: rejected_reasons.length,
      rejected_reasons,
      emitted_operations: 0,
      batch_id: batch.batch_id,
    };
  }

  // Phase 2: persist ScraperEvent rows. Using `createMany` for throughput,
  // then `findMany` to recover IDs in the order we inserted so we can map
  // transformer verdicts back to rows.
  //
  // `skipDuplicates: true` is a no-op here (no unique constraint besides id)
  // but keeps us safe if one gets added later.
  await prisma.scraperEvent.createMany({
    data: staged.map((s) => s.data),
    skipDuplicates: true,
  });

  // Fetch the rows we just inserted so we get their generated IDs and the
  // exact stored values (sanitized headers/body) to feed the adapter. We
  // filter by a narrow time window + employee_id + captured_at list to
  // recover them deterministically even under concurrent writes from other
  // employees.
  const capturedAts = staged.map((s) => s.data.captured_at as Date);
  const justInserted = await prisma.scraperEvent.findMany({
    where: {
      employee_id: user.sub,
      captured_at: { in: capturedAts },
      processed_at: null,
    },
    orderBy: { created_at: "asc" },
  });

  // Match staged entries to DB rows by (employee_id, captured_at, url, method).
  // If more than one candidate matches a staged entry (extremely unlikely),
  // we consume the first unseen one. Any unmapped staged event is logged.
  const dbRowByCompositeKey = new Map<string, typeof justInserted[number][]>();
  for (const row of justInserted) {
    const key = `${row.captured_at.toISOString()}|${row.url}|${row.method}`;
    const bucket = dbRowByCompositeKey.get(key);
    if (bucket) bucket.push(row);
    else dbRowByCompositeKey.set(key, [row]);
  }

  const transformerEvents: TransformerInputEvent[] = [];
  const stagedToRowId = new Map<number, string>(); // staged.index -> DB row id

  for (const s of staged) {
    const key = `${(s.data.captured_at as Date).toISOString()}|${s.data.url}|${s.data.method}`;
    const bucket = dbRowByCompositeKey.get(key);
    const row = bucket?.shift();
    if (!row) {
      logger.warn(
        { batch_id: batch.batch_id, url: s.data.url },
        "Inserted ScraperEvent row could not be re-fetched — skipping transformer",
      );
      continue;
    }
    stagedToRowId.set(s.index, row.id);
    transformerEvents.push({
      id: row.id,
      employee_id: row.employee_id,
      insurer_code: row.insurer_code,
      host: row.host,
      url: row.url,
      pathname: safePathname(row.url),
      method: row.method,
      status_code: row.status_code,
      request_headers: row.request_headers as Record<string, string> | null,
      request_body: row.request_body,
      response_headers: row.response_headers as Record<string, string> | null,
      response_body: row.response_body,
      captured_at: row.captured_at,
    });
  }

  // Phase 3: run ScraperAdapter.
  const adapter = adapterRegistry.get("scraper");
  if (!adapter) {
    // Should be impossible (registered at module load) but defend in depth.
    logger.error({}, "ScraperAdapter not registered — cannot process batch");
    rememberBatchId(batch.batch_id);
    return {
      accepted: staged.length,
      rejected: rejected_reasons.length,
      rejected_reasons,
      emitted_operations: 0,
      batch_id: batch.batch_id,
    };
  }

  const verdictBuffer: TransformerVerdictAnnotation[] = [];
  const adapterInput: ScraperAdapterInput = {
    events: transformerEvents,
    operator_code: user.operator_code,
    verdicts: verdictBuffer,
  };

  let operations: ParsedOperation[] = [];
  try {
    operations = await adapter.parse(adapterInput);
  } catch (err) {
    // Adapter errors should have been caught per-host by adapter itself;
    // if we end up here, tag every event as ERROR.
    const message = err instanceof Error ? err.message : "Erreur adaptateur inconnue";
    logger.error({ err, batch_id: batch.batch_id }, "ScraperAdapter threw");
    for (const ev of transformerEvents) {
      verdictBuffer.push({
        event_id: ev.id,
        verdict: "ERROR",
        notes: `Adaptateur scraper: ${message}`,
      });
    }
  }

  // Phase 4: persist verdicts back onto ScraperEvent rows.
  const now = new Date();
  const verdictByEventId = new Map<string, TransformerVerdictAnnotation>();
  for (const v of verdictBuffer) {
    // Prefer the last annotation if a transformer produced multiple for one event
    // (shouldn't happen, but be defensive).
    verdictByEventId.set(v.event_id, v);
  }

  // Batch the verdict write-backs using a transaction of per-row updates. We
  // cannot use `updateMany` because each row gets a different verdict/notes.
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const [eventId, verdict] of verdictByEventId) {
    updates.push(
      prisma.scraperEvent.update({
        where: { id: eventId },
        data: {
          transformer_verdict: verdict.verdict,
          transformer_notes: verdict.notes ?? null,
          processed_at: now,
        },
      }),
    );
  }
  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  // Phase 5: dedup + upsert operations, then emit Socket.IO for each new row.
  let emittedOperations = 0;
  if (operations.length > 0) {
    // Capture the set of dedup keys that ALREADY exist in `Operation` BEFORE
    // the upsert runs, so afterwards we can tell which rows are genuinely new
    // (emit) vs which were idempotent updates (suppress). Using `?? null`
    // (see normalizeDedupKey) so the Prisma query matches NULL columns with
    // `IS NULL` rather than `= ''`, which would silently miss every already-
    // persisted row whose avenant/quittance is unset.
    const dedupKeys = operations.map((op) =>
      normalizeDedupKey({
        type: op.type,
        policy_number: op.policy_number,
        avenant_number: op.avenant_number,
        quittance_number: op.quittance_number,
      }),
    );
    const existingKeys = await existingOperationDedupKeys(prisma, dedupKeys);

    await dedupAndPersist(prisma, operations);

    // Rows whose key wasn't in the pre-persist set are the ones just created.
    const newOpKeys = dedupKeys.filter((k) => !existingKeys.has(hashDedupKey(k)));

    if (newOpKeys.length > 0) {
      const emittable = await prisma.operation.findMany({
        where: {
          OR: newOpKeys.map((k) => ({
            type: k.type,
            policy_number: k.policy_number,
            avenant_number: k.avenant_number,
            quittance_number: k.quittance_number,
          })),
        },
        include: { employee: { select: { full_name: true } } },
        orderBy: { created_at: "desc" },
      });

      for (const row of emittable) {
        io.to("dashboard").emit(SOCKET_EVENTS.OPERATION_NEW, {
          operation: toActivityItem(row),
        });
        emittedOperations++;
      }
    }
  }

  rememberBatchId(batch.batch_id);

  return {
    accepted: staged.length,
    rejected: rejected_reasons.length,
    rejected_reasons,
    emitted_operations: emittedOperations,
    batch_id: batch.batch_id,
  };
}

// ─── listEvents ───────────────────────────────────────────────────────

/**
 * Paginated list of ScraperEvent rows. EMPLOYEE role is auto-filtered to own
 * events. MANAGER sees all and may filter by employee_id. Also supports
 * full-text-ish search across host/pathname/url.
 */
export async function listEvents(
  prisma: PrismaClient,
  filters: ScraperEventsQuery,
  user: RequestUser,
): Promise<{
  items: ScraperEventListItem[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
}> {
  const page = filters.page ?? 1;
  const pageSize = filters.page_size ?? 50;

  const where: Prisma.ScraperEventWhereInput = {};

  // RBAC
  if (user.role === "EMPLOYEE") {
    where.employee_id = user.sub;
  } else if (filters.employee_id) {
    where.employee_id = filters.employee_id;
  }

  if (filters.host) {
    where.host = { contains: filters.host.toLowerCase(), mode: "insensitive" };
  }
  if (filters.insurer_code) {
    where.insurer_code = filters.insurer_code;
  }
  const verdict = mapVerdictFilter(filters.verdict);
  if (verdict) where.transformer_verdict = verdict;

  if (filters.from || filters.to) {
    where.captured_at = {};
    if (filters.from) where.captured_at.gte = new Date(filters.from);
    if (filters.to) where.captured_at.lte = new Date(filters.to);
  }

  if (filters.q) {
    const q = filters.q;
    where.OR = [
      { url: { contains: q, mode: "insensitive" } },
      { host: { contains: q, mode: "insensitive" } },
      { method: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, totalItems] = await Promise.all([
    prisma.scraperEvent.findMany({
      where,
      include: {
        employee: { select: { full_name: true, operator_code: true } },
      },
      orderBy: { captured_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.scraperEvent.count({ where }),
  ]);

  // Centralised mapping via `toScraperEventListItem` so the DTO shape is
  // identical between list + detail endpoints and the DB column name
  // `transformer_notes` is preserved (see feedback-iteration-1 B7).
  const items: ScraperEventListItem[] = rows.map(toScraperEventListItem);

  return {
    items,
    pagination: {
      page,
      per_page: pageSize,
      total_items: totalItems,
      total_pages: Math.ceil(totalItems / pageSize),
    },
  };
}

// ─── getEvent ────────────────────────────────────────────────────────

export async function getEvent(
  prisma: PrismaClient,
  id: string,
  user: RequestUser,
): Promise<ScraperEventDetail> {
  const row = await prisma.scraperEvent.findUnique({
    where: { id },
    include: {
      employee: { select: { full_name: true, operator_code: true } },
    },
  });

  if (!row) {
    throw Object.assign(new Error("Événement introuvable."), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  if (user.role === "EMPLOYEE" && row.employee_id !== user.sub) {
    throw Object.assign(
      new Error("Vous ne pouvez consulter que vos propres événements."),
      { statusCode: 403, code: "AUTH_INSUFFICIENT_ROLE" },
    );
  }

  // Spread the list DTO then add detail-only fields. Keeps `transformer_notes`
  // (B7) and `pathname`/`employee` projection in sync with the list route.
  return {
    ...toScraperEventListItem(row),
    request_headers: row.request_headers as Record<string, string> | null,
    response_headers: row.response_headers as Record<string, string> | null,
    request_body: row.request_body,
    response_body: row.response_body,
  };
}

// ─── replayEvent ─────────────────────────────────────────────────────

/**
 * Re-run a single persisted ScraperEvent through the transformer pipeline.
 * Intended for MANAGER-only use after a transformer is fixed/upgraded.
 * Updates the event's verdict + notes + processed_at, and emits any newly
 * produced operation.
 */
export async function replayEvent(
  prisma: PrismaClient,
  io: ScraperIo,
  id: string,
): Promise<{
  event_id: string;
  verdict: TransformerVerdict;
  emitted_operations: number;
}> {
  const row = await prisma.scraperEvent.findUnique({
    where: { id },
    include: { employee: { select: { operator_code: true } } },
  });
  if (!row) {
    throw Object.assign(new Error("Événement introuvable."), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  const adapter = adapterRegistry.get("scraper");
  if (!adapter) {
    throw Object.assign(new Error("Adaptateur scraper indisponible."), {
      statusCode: 500,
      code: "ADAPTER_MISSING",
    });
  }

  const verdicts: TransformerVerdictAnnotation[] = [];
  const adapterInput: ScraperAdapterInput = {
    events: [
      {
        id: row.id,
        employee_id: row.employee_id,
        insurer_code: row.insurer_code,
        host: row.host,
        url: row.url,
        pathname: safePathname(row.url),
        method: row.method,
        status_code: row.status_code,
        request_headers: row.request_headers as Record<string, string> | null,
        request_body: row.request_body,
        response_headers: row.response_headers as Record<string, string> | null,
        response_body: row.response_body,
        captured_at: row.captured_at,
      },
    ],
    operator_code: row.employee?.operator_code ?? "",
    verdicts,
  };

  let operations: ParsedOperation[] = [];
  try {
    operations = await adapter.parse(adapterInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur adaptateur inconnue";
    verdicts.push({
      event_id: row.id,
      verdict: "ERROR",
      notes: `Adaptateur scraper: ${message}`,
    });
  }

  const annotation = verdicts.find((v) => v.event_id === row.id);
  const finalVerdict: TransformerVerdict = annotation?.verdict ?? "IGNORED";
  const finalNotes = annotation?.notes ?? null;

  await prisma.scraperEvent.update({
    where: { id: row.id },
    data: {
      transformer_verdict: finalVerdict,
      transformer_notes: finalNotes,
      processed_at: new Date(),
    },
  });

  let emittedOperations = 0;
  if (operations.length > 0) {
    // Same NULL-vs-empty-string correctness issue as ingestEvents — see
    // feedback-iteration-1 B5. `?? null` (via normalizeDedupKey) so Prisma
    // emits `IS NULL` and matches the rows written through the CREATE path.
    const dedupKeys = operations.map((op) =>
      normalizeDedupKey({
        type: op.type,
        policy_number: op.policy_number,
        avenant_number: op.avenant_number,
        quittance_number: op.quittance_number,
      }),
    );
    const existingKeys = await existingOperationDedupKeys(prisma, dedupKeys);

    await dedupAndPersist(prisma, operations);

    const newOpKeys = dedupKeys.filter((k) => !existingKeys.has(hashDedupKey(k)));

    if (newOpKeys.length > 0) {
      const emittable = await prisma.operation.findMany({
        where: {
          OR: newOpKeys.map((k) => ({
            type: k.type,
            policy_number: k.policy_number,
            avenant_number: k.avenant_number,
            quittance_number: k.quittance_number,
          })),
        },
        include: { employee: { select: { full_name: true } } },
        orderBy: { created_at: "desc" },
      });

      for (const r of emittable) {
        io.to("dashboard").emit(SOCKET_EVENTS.OPERATION_NEW, {
          operation: toActivityItem(r),
        });
        emittedOperations++;
      }
    }
  }

  return {
    event_id: row.id,
    verdict: finalVerdict,
    emitted_operations: emittedOperations,
  };
}

// ─── InsurerDomain CRUD ──────────────────────────────────────────────

function toInsurerDomainDto(row: {
  id: string;
  insurer_code: string;
  host_pattern: string;
  label: string;
  capture_enabled: boolean;
  created_at: Date;
}): InsurerDomainDto {
  return {
    id: row.id,
    insurer_code: row.insurer_code,
    host_pattern: row.host_pattern,
    label: row.label,
    capture_enabled: row.capture_enabled,
    created_at: row.created_at.toISOString(),
  };
}

export async function listDomains(
  prisma: PrismaClient,
): Promise<InsurerDomainDto[]> {
  const rows = await prisma.insurerDomain.findMany({
    orderBy: [{ insurer_code: "asc" }, { created_at: "asc" }],
  });
  return rows.map(toInsurerDomainDto);
}

export async function createDomain(
  prisma: PrismaClient,
  data: InsurerDomainInput,
  createdById: string,
): Promise<InsurerDomainDto> {
  // Defense in depth: Zod already validated with new RegExp(p). If the DB
  // already has this host_pattern, surface a 409.
  const existing = await prisma.insurerDomain.findUnique({
    where: { host_pattern: data.host_pattern },
  });
  if (existing) {
    throw Object.assign(new Error("Ce motif d'hôte existe déjà."), {
      statusCode: 409,
      code: "DOMAIN_DUPLICATE",
    });
  }

  const row = await prisma.insurerDomain.create({
    data: {
      host_pattern: data.host_pattern,
      insurer_code: data.insurer_code,
      label: sanitizeOptional(data.label) ?? data.label,
      capture_enabled: data.capture_enabled,
      created_by_id: createdById,
    },
  });
  return toInsurerDomainDto(row);
}

export async function updateDomain(
  prisma: PrismaClient,
  id: string,
  data: InsurerDomainInput,
): Promise<InsurerDomainDto> {
  const existing = await prisma.insurerDomain.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error("Domaine introuvable."), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  // If the host_pattern is being changed, ensure no other row uses the new one.
  if (data.host_pattern !== existing.host_pattern) {
    const clash = await prisma.insurerDomain.findUnique({
      where: { host_pattern: data.host_pattern },
    });
    if (clash && clash.id !== id) {
      throw Object.assign(new Error("Ce motif d'hôte existe déjà."), {
        statusCode: 409,
        code: "DOMAIN_DUPLICATE",
      });
    }
  }

  const row = await prisma.insurerDomain.update({
    where: { id },
    data: {
      host_pattern: data.host_pattern,
      insurer_code: data.insurer_code,
      label: sanitizeOptional(data.label) ?? data.label,
      capture_enabled: data.capture_enabled,
    },
  });
  return toInsurerDomainDto(row);
}

export async function deleteDomain(
  prisma: PrismaClient,
  id: string,
): Promise<void> {
  const existing = await prisma.insurerDomain.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error("Domaine introuvable."), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }
  await prisma.insurerDomain.delete({ where: { id } });
}

// ─── Stats ────────────────────────────────────────────────────────────

export async function getStats(
  prisma: PrismaClient,
  employeeId?: string,
): Promise<ScraperEventStats> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const scope: Prisma.ScraperEventWhereInput = employeeId
    ? { employee_id: employeeId }
    : {};

  const todayScope: Prisma.ScraperEventWhereInput = {
    ...scope,
    captured_at: { gte: startOfToday },
  };

  const [capturedToday, transformedToday, errorsToday, lastCaptured] =
    await Promise.all([
      prisma.scraperEvent.count({ where: todayScope }),
      prisma.scraperEvent.count({
        where: { ...todayScope, transformer_verdict: "TRANSFORMED" },
      }),
      prisma.scraperEvent.count({
        where: { ...todayScope, transformer_verdict: "ERROR" },
      }),
      prisma.scraperEvent.findFirst({
        where: scope,
        orderBy: { captured_at: "desc" },
        select: { captured_at: true },
      }),
    ]);

  return {
    captured_today: capturedToday,
    transformed_today: transformedToday,
    errors_today: errorsToday,
    last_captured_at: lastCaptured?.captured_at.toISOString() ?? null,
  };
}

// ─── Retention ────────────────────────────────────────────────────────

/**
 * Delete ScraperEvent rows older than `retentionDays`. Returns the number of
 * rows removed. Called periodically from `app.ts`'s onReady interval hook.
 *
 * Cutoff is based on `captured_at` — the business-relevant "when the exchange
 * happened" timestamp — NOT `created_at`, which is server-ingestion time and
 * can lag by hours if a batch is replayed or arrives after a connectivity
 * outage. See feedback-iteration-1 B6.
 */
export async function purgeExpiredEvents(
  prisma: PrismaClient,
  retentionDays: number,
): Promise<number> {
  if (retentionDays <= 0) return 0;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const { count } = await prisma.scraperEvent.deleteMany({
    where: { captured_at: { lt: cutoff } },
  });
  return count;
}
