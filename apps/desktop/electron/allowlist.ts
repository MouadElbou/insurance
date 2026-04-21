/**
 * Shared allowlist compilation + host matching.
 *
 * Both `PortalManager` (F1 navigation guards) and `NetworkInterceptor`
 * (F3 request/response capture gate) import from here so there is exactly
 * ONE source of truth for "is this host allowed?" — duplicating the regex
 * cache in two places would let the two subsystems drift (e.g. capture
 * enabled but navigation blocked, or vice-versa).
 *
 * Two-layer ReDoS defense on every entry:
 *   1. `isSafeRegexSource` static analyzer rejects nested-quantifier shapes
 *      like `^(a+)+

 before they ever hit the engine.
 *   2. `new RegExp(...)` inside try/catch guards against patterns that the
 *      engine itself refuses.
 * See `packages/shared/src/utils/regex-safety.ts`.
 *
 * Compiled regexes are memoised by `id + ":" + updated_at` (with
 * `created_at` fallback for legacy rows without `updated_at`). When an
 * admin edits a domain on the server, its `updated_at` bumps, the cache
 * key changes, and the entry is recompiled — so stale regexes never
 * linger.
 */
import type { InsurerDomainAllowlistEntry } from "@insurance/shared";
import { isSafeRegexSource } from "@insurance/shared";

export interface CompiledAllowlistEntry {
  id: string;
  updated_at: string;
  insurer_code: string;
  capture_enabled: boolean;
  label: string;
  host_pattern: string;
  pattern: RegExp;
}

export interface AllowlistRejection {
  id: string;
  host_pattern: string;
  reason: "unsafe-regex" | "invalid-syntax";
}

export interface AllowlistCompileResult {
  compiled: CompiledAllowlistEntry[];
  rejected: AllowlistRejection[];
}

// Module-level cache. Key: `${id}:${updated_at ?? created_at}`.
const regexCache = new Map<string, RegExp>();

function cacheKey(entry: InsurerDomainAllowlistEntry): string {
  // `updated_at` is optional on the wire; fall back to `created_at` so
  // legacy rows still get a stable key.
  const version = entry.updated_at ?? entry.created_at;
  return `${entry.id}:${version}`;
}

/**
 * Compile a list of allowlist entries.
 *
 * Entries that fail either the static safety check or regex compilation
 * are returned in `rejected` with a machine-readable reason code — the
 * caller (network-interceptor) is expected to surface them to the
 * renderer via the `scraper:allowlist-error` IPC channel so the operator
 * knows their row is broken instead of silently dropping it.
 */
export function compileAllowlist(
  entries: InsurerDomainAllowlistEntry[],
): AllowlistCompileResult {
  const compiled: CompiledAllowlistEntry[] = [];
  const rejected: AllowlistRejection[] = [];
  const seenKeys = new Set<string>();

  for (const entry of entries) {
    const key = cacheKey(entry);
    seenKeys.add(key);

    let pattern = regexCache.get(key);
    if (!pattern) {
      if (!isSafeRegexSource(entry.host_pattern)) {
        rejected.push({
          id: entry.id,
          host_pattern: entry.host_pattern,
          reason: "unsafe-regex",
        });
        continue;
      }
      try {
        pattern = new RegExp(entry.host_pattern, "i");
        regexCache.set(key, pattern);
      } catch {
        rejected.push({
          id: entry.id,
          host_pattern: entry.host_pattern,
          reason: "invalid-syntax",
        });
        continue;
      }
    }

    compiled.push({
      id: entry.id,
      updated_at: entry.updated_at ?? entry.created_at,
      insurer_code: entry.insurer_code,
      capture_enabled: entry.capture_enabled,
      label: entry.label,
      host_pattern: entry.host_pattern,
      pattern,
    });
  }

  // Evict cache entries for rows that no longer exist so the Map doesn't
  // grow unbounded across days of admin edits.
  for (const key of regexCache.keys()) {
    if (!seenKeys.has(key)) regexCache.delete(key);
  }

  return { compiled, rejected };
}

/**
 * Test a URL against a compiled allowlist.
 *
 * Returns the insurer_code of the first matching entry (capture_enabled
 * is NOT required here — navigation guards allow admin-disabled domains
 * to load, capture simply won't record traffic). Malformed URLs are
 * treated as denied.
 */
export function isHostAllowed(
  url: string,
  entries: CompiledAllowlistEntry[],
): { ok: boolean; insurerCode: string | null } {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return { ok: false, insurerCode: null };
  }
  for (const entry of entries) {
    if (entry.pattern.test(host)) {
      return { ok: true, insurerCode: entry.insurer_code };
    }
  }
  return { ok: false, insurerCode: null };
}

/**
 * Same as `isHostAllowed` but requires `capture_enabled: true`. Used by
 * the network interceptor to decide whether to record the exchange —
 * navigation may be allowed even when capture is paused (e.g. operator
 * is just browsing).
 */
export function isHostCaptured(
  host: string,
  entries: CompiledAllowlistEntry[],
): { captured: boolean; insurerCode: string | null } {
  for (const entry of entries) {
    if (!entry.capture_enabled) continue;
    if (entry.pattern.test(host)) {
      return { captured: true, insurerCode: entry.insurer_code };
    }
  }
  return { captured: false, insurerCode: null };
}
