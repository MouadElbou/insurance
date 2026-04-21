/**
 * Transformer registry.
 *
 * Each insurer has one `Transformer` that maps raw ScraperEvent rows into
 * ParsedOperation records. The registry routes events to a transformer by
 * matching the event's `host` against each transformer's `hostPattern`.
 *
 * This registry is intentionally static (no runtime registration) — adding an
 * insurer means editing this file, which makes the capture surface auditable
 * at code-review time.
 */
import { RmaTransformer } from "./rma.transformer.js";
import type { Transformer } from "./transformer.interface.js";

/**
 * All registered transformers in priority order. The first transformer whose
 * `hostPattern.test(host)` returns true wins. Keep insurer entries disjoint
 * to avoid surprising ordering effects.
 */
export const transformers: ReadonlyArray<Transformer> = [new RmaTransformer()];

/**
 * Look up the transformer responsible for `host`, or `undefined` if no
 * transformer is registered for this domain.
 */
export function findTransformer(host: string): Transformer | undefined {
  const normalized = host.trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  return transformers.find((t) => t.hostPattern.test(normalized));
}

/**
 * Look up a transformer by exact `insurer_code`. Used when an event already
 * carries a resolved insurer_code (from the InsurerDomain allowlist) and we
 * want to bypass host matching.
 */
export function findTransformerByInsurerCode(
  insurer_code: string,
): Transformer | undefined {
  return transformers.find((t) => t.insurer_code === insurer_code);
}

export type { Transformer } from "./transformer.interface.js";
