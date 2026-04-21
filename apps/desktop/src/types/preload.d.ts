import type {
  ScraperBatchRequest,
  PortalStatus,
  InsurerDomainAllowlistEntry,
} from "@insurance/shared";

/**
 * Main-emitted rejection payload for rows whose `host_pattern` fails
 * either the `isSafeRegexSource` static check or `new RegExp(...)`
 * compilation. Kept inline here instead of imported so the renderer
 * doesn't pull an allowlist-compile implementation into its bundle.
 */
export interface AllowlistRejection {
  id: string;
  host_pattern: string;
  reason: "unsafe-regex" | "invalid-syntax";
}

declare global {
  interface Window {
    electronAPI: {
      storeTokens(tokens: {
        access: string;
        refresh: string;
      }): Promise<void>;
      getTokens(): Promise<{ access: string; refresh: string } | null>;
      clearTokens(): Promise<void>;
      getAppVersion(): Promise<string>;
      getPlatform(): string;
      minimizeToTray(): void;
      quitApp(): void;
    };
    scraperAPI: {
      openPortal(
        insurerCode: string,
        startUrl: string,
      ): Promise<{ ok: boolean; error?: string }>;
      closePortal(): Promise<{ ok: boolean; error?: string }>;
      getStatus(): Promise<PortalStatus | null>;
      onStatus(cb: (status: PortalStatus) => void): () => void;
      onFlushBatch(
        cb: (payload: {
          batch: ScraperBatchRequest;
          replyChannel: string;
        }) => void,
      ): () => void;
      replyFlush(replyChannel: string, ok: boolean, error?: string): void;
      /**
       * F4 — authoritative allowlist push from main. Fires after main
       * successfully fetches `/api/v1/scraper/insurer-domains` and
       * validates the response with Zod. Replaces the legacy
       * `onAllowlistRefresh` broadcast that shared a channel name
       * with the refresh trigger.
       */
      onAllowlistSync(
        cb: (entries: InsurerDomainAllowlistEntry[]) => void,
      ): () => void;
      /**
       * F3 — fires when one or more allowlist rows fail to compile
       * (unsafe ReDoS pattern or invalid syntax). Renderer should
       * surface this as a toast pointing the operator at the offending
       * rows so they can fix them in `/insurer-domains`.
       */
      onAllowlistError(
        cb: (rejections: AllowlistRejection[]) => void,
      ): () => void;
      setViewportBounds(
        rect: { x: number; y: number; width: number; height: number } | null,
      ): void;
      /**
       * Trigger-only. Main does the fetch + Zod-validation + setAllowlist;
       * the renderer cannot pass a payload any more. `{ ok, error? }`
       * is returned so callers can toast on fetch failure.
       */
      refreshAllowlist(): Promise<{ ok: boolean; error?: string }>;
    };
  }
}

export {};
