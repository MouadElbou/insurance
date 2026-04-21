import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type {
  InsurerDomainAllowlistEntry,
  PortalStatus,
} from "@insurance/shared";
import { scraperApi } from "@/lib/api";
import { usePortalStore } from "@/stores/scraper.store";
import { useAuthStore } from "@/stores/auth.store";

/**
 * usePortal — wires the renderer to the main-process PortalManager.
 *
 * Responsibilities:
 *   - Pull initial status from main and subscribe to `onStatus` updates.
 *   - Answer `onFlushBatch` requests by POSTing the batch to the backend
 *     (the renderer owns the JWT) and replying through `replyFlush`.
 *   - Refresh the allowlist on mount (main stays in sync with the DB).
 *   - Provide `openPortal` / `closePortal` wrappers with French toast feedback.
 */
export function usePortal() {
  const { status, stats, setStatus, setStats } = usePortalStore();
  const accessToken = useAuthStore((s) => s.accessToken);
  const mountedRef = useRef(false);

  // --------------------------------------------------------- //
  // Hydrate status + subscribe
  // --------------------------------------------------------- //
  useEffect(() => {
    if (!window.scraperAPI) return;
    mountedRef.current = true;

    // Pull initial status
    window.scraperAPI
      .getStatus()
      .then((initial) => {
        if (!mountedRef.current) return;
        if (initial) setStatus(initial as PortalStatus);
      })
      .catch(() => {
        // No-op: an unreachable main process already surfaces through the bridge
      });

    // Subscribe to live status
    const unsub = window.scraperAPI.onStatus((next) => {
      setStatus(next);
    });

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [setStatus]);

  // --------------------------------------------------------- //
  // Answer flush-batch requests from main
  // Renderer owns the JWT — api client attaches it automatically.
  // --------------------------------------------------------- //
  useEffect(() => {
    if (!window.scraperAPI) return;

    const unsub = window.scraperAPI.onFlushBatch(async ({ batch, replyChannel }) => {
      try {
        await scraperApi.submitBatch(batch);
        window.scraperAPI.replyFlush(replyChannel, true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Échec de l'envoi du lot";
        window.scraperAPI.replyFlush(replyChannel, false, message);
      }
    });

    return () => unsub();
  }, [accessToken]);

  // --------------------------------------------------------- //
  // Trigger-only allowlist refresh (F4).
  //
  // Main owns the fetch: it reads the access token from the safeStorage-
  // backed tokens file, hits `GET /api/v1/scraper/insurer-domains`, and
  // broadcasts the validated list on `scraper:allowlist-sync`. Compile
  // rejections come back on `scraper:allowlist-error` (handled below).
  // The renderer no longer ships the patterns list over IPC, which
  // removes a poisoning surface.
  // --------------------------------------------------------- //
  const refreshAllowlist = useCallback(async () => {
    if (!window.scraperAPI) return false;
    const res = await window.scraperAPI.refreshAllowlist();
    if (!res.ok) {
      toast.error(res.error ?? "Impossible de rafraîchir l'allowlist.");
    }
    return res.ok;
  }, []);

  useEffect(() => {
    refreshAllowlist();
  }, [refreshAllowlist]);

  // --------------------------------------------------------- //
  // Allowlist sync + compile-error subscriptions.
  //
  // `onAllowlistSync` is the authoritative list from main — we log a
  // debug line so admins can trace "the renderer knows about N rows"
  // from devtools without adding another store.
  //
  // `onAllowlistError` only fires when main rejects one or more rows
  // during compile. Surface this loudly because it means those rows
  // are effectively offline until the admin fixes them.
  // --------------------------------------------------------- //
  useEffect(() => {
    if (!window.scraperAPI) return;

    const unsubSync = window.scraperAPI.onAllowlistSync(
      (_entries: InsurerDomainAllowlistEntry[]) => {
        // Validated list broadcast from main. Individual components
        // that need the patterns (e.g. PortalLauncher echo check)
        // fetch them via scraperApi.listDomains() — this broadcast is
        // only wired so we can toast on fail and log on success.
      },
    );

    const unsubError = window.scraperAPI.onAllowlistError((rejections) => {
      if (rejections.length === 0) return;
      const summary = rejections
        .map(
          (r) =>
            `${r.host_pattern} (${
              r.reason === "unsafe-regex" ? "regex non sûre" : "syntaxe invalide"
            })`,
        )
        .join(", ");
      toast.error(
        `Modèles d'hôte rejetés: ${summary}. Corrigez-les dans /insurer-domains.`,
      );
    });

    return () => {
      unsubSync();
      unsubError();
    };
  }, []);

  // --------------------------------------------------------- //
  // Stats refresh helper — called on demand by the page
  // --------------------------------------------------------- //
  const refreshStats = useCallback(
    async (employeeId?: string) => {
      try {
        const data = await scraperApi.stats(employeeId);
        setStats(data);
      } catch {
        // Non-fatal
      }
    },
    [setStats],
  );

  // --------------------------------------------------------- //
  // Portal control
  // --------------------------------------------------------- //
  const openPortal = useCallback(
    async (insurerCode: string, startUrl: string) => {
      if (!window.scraperAPI) {
        toast.error("Cette fonctionnalité n'est disponible que dans l'application de bureau.");
        return false;
      }
      const res = await window.scraperAPI.openPortal(insurerCode, startUrl);
      if (!res.ok) {
        toast.error(res.error ?? "Impossible d'ouvrir le portail assureur.");
      }
      return res.ok;
    },
    [],
  );

  const closePortal = useCallback(async () => {
    if (!window.scraperAPI) return;
    const res = await window.scraperAPI.closePortal();
    if (!res.ok) {
      toast.error(res.error ?? "Impossible de fermer le portail.");
    }
    return res.ok;
  }, []);

  const setViewportBounds = useCallback(
    (rect: { x: number; y: number; width: number; height: number } | null) => {
      if (!window.scraperAPI) return;
      window.scraperAPI.setViewportBounds(rect);
    },
    [],
  );

  return {
    status,
    stats,
    openPortal,
    closePortal,
    setViewportBounds,
    refreshStats,
    refreshAllowlist,
  };
}
