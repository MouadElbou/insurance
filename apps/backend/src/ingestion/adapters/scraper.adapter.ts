/**
 * ScraperAdapter — bridges raw captured HTTP events into the ingestion
 * pipeline's standard `ParsedOperation` shape.
 *
 * This adapter does NOT persist anything. Per the `IngestionAdapter` contract
 * it is side-effect free: the scraper service owns DB writes, verdict
 * annotation, and Socket.IO emission. The adapter's only job is:
 *   1. Group events by host.
 *   2. Route each group to the matching transformer via the registry.
 *   3. Aggregate the resulting operations.
 *
 * Verdicts produced by transformers are captured separately on the input
 * object (see `ScraperAdapterInput.verdicts`) so the service can persist them
 * back onto each ScraperEvent row without re-running the transform step.
 */
import type { IngestionAdapter, ParsedOperation } from "../adapter.interface.js";
import { findTransformer } from "../transformers/index.js";
import type {
  TransformerInputEvent,
  TransformerVerdictAnnotation,
} from "../transformers/transformer.interface.js";

/**
 * Input payload for `ScraperAdapter.parse`. The service constructs this after
 * loading a batch of ScraperEvent rows from the DB.
 *
 * `verdicts` is an out-parameter: the adapter appends one annotation per
 * event (including IGNORED when no transformer matches) so the service can
 * write them back without a second pass.
 */
export interface ScraperAdapterInput {
  events: TransformerInputEvent[];
  operator_code: string;
  /**
   * Populated by `parse()`. MUST be an empty array when passed in — the
   * adapter writes into it. Keeps parse()'s public signature
   * `Promise<ParsedOperation[]>` intact per the IngestionAdapter contract.
   */
  verdicts: TransformerVerdictAnnotation[];
}

export class ScraperAdapter implements IngestionAdapter {
  name = "scraper";

  async parse(input: unknown): Promise<ParsedOperation[]> {
    const payload = input as ScraperAdapterInput;
    if (
      !payload ||
      !Array.isArray(payload.events) ||
      typeof payload.operator_code !== "string" ||
      !Array.isArray(payload.verdicts)
    ) {
      throw new Error("ScraperAdapter: invalid input shape");
    }

    const { events, operator_code, verdicts } = payload;
    if (events.length === 0) return [];

    // Group by lowercased host so each transformer sees only its own events.
    const byHost = new Map<string, TransformerInputEvent[]>();
    for (const e of events) {
      const host = (e.host ?? "").trim().toLowerCase();
      const bucket = byHost.get(host);
      if (bucket) {
        bucket.push(e);
      } else {
        byHost.set(host, [e]);
      }
    }

    const operations: ParsedOperation[] = [];

    for (const [host, hostEvents] of byHost) {
      const transformer = findTransformer(host);

      if (!transformer) {
        // No transformer registered for this host — annotate each event as
        // IGNORED so the service persists the verdict. This should rarely
        // happen in practice because the ingest route rejects hosts not in
        // the InsurerDomain allowlist, but we defend in depth.
        for (const e of hostEvents) {
          verdicts.push({
            event_id: e.id,
            verdict: "IGNORED",
            notes: `Aucun transformateur disponible pour l'hôte ${host}`,
          });
        }
        continue;
      }

      try {
        const result = await transformer.transform(hostEvents, {
          operatorCode: operator_code,
        });
        operations.push(...result.operations);
        verdicts.push(...result.verdicts);
      } catch (err) {
        // A transformer should NEVER throw per contract — but if it does,
        // we surface ERROR verdicts for every event in the group and
        // continue with the next host rather than aborting the batch.
        const message = err instanceof Error ? err.message : "Erreur transformateur inconnue";
        for (const e of hostEvents) {
          verdicts.push({
            event_id: e.id,
            verdict: "ERROR",
            notes: `Transformateur ${transformer.insurer_code} a levé: ${message}`,
          });
        }
      }
    }

    return operations;
  }
}
