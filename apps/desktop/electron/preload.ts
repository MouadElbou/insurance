import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  InsurerDomainAllowlistEntry,
  PortalStatus,
  ScraperBatchRequest,
} from "@insurance/shared";

// ------------------------------------------------------------------ //
// electronAPI — existing surface (tokens, app info, window controls)
// ------------------------------------------------------------------ //
contextBridge.exposeInMainWorld("electronAPI", {
  storeTokens: (tokens: { access: string; refresh: string }): Promise<void> =>
    ipcRenderer.invoke("tokens:store", tokens),

  getTokens: (): Promise<{ access: string; refresh: string } | null> =>
    ipcRenderer.invoke("tokens:get"),

  clearTokens: (): Promise<void> => ipcRenderer.invoke("tokens:clear"),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke("app:version"),

  getPlatform: (): string => process.platform,

  minimizeToTray: (): void => {
    ipcRenderer.send("window:minimize-to-tray");
  },

  quitApp: (): void => {
    ipcRenderer.send("window:quit");
  },
});

// ------------------------------------------------------------------ //
// scraperAPI — portal capture surface
// ------------------------------------------------------------------ //
//
// The renderer owns the JWT. When main has a batch to flush it sends a
// "scraper:flush-batch" message with a reply channel; the renderer POSTs the
// batch to the backend and calls replyFlush(replyChannel, ok, error?) to ack.
//
// onStatus / onFlushBatch return an unsubscribe function — the caller MUST
// call it on unmount to avoid leaking listeners.
//
// F6 — payload types come from `@insurance/shared` so the renderer
// can no longer see these as `unknown[]`. Main still validates with
// Zod at the boundary; these type annotations are descriptive, not a
// trust signal.
//
contextBridge.exposeInMainWorld("scraperAPI", {
  openPortal: (
    insurerCode: string,
    startUrl: string,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("scraper:open-portal", {
      insurer_code: insurerCode,
      start_url: startUrl,
    }),

  closePortal: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("scraper:close-portal"),

  getStatus: (): Promise<PortalStatus | null> =>
    ipcRenderer.invoke("scraper:get-status"),

  onStatus: (cb: (status: PortalStatus) => void): (() => void) => {
    const handler = (_ev: IpcRendererEvent, payload: PortalStatus) =>
      cb(payload);
    ipcRenderer.on("scraper:portal-status", handler);
    return () => ipcRenderer.removeListener("scraper:portal-status", handler);
  },

  onFlushBatch: (
    cb: (payload: {
      batch: ScraperBatchRequest;
      replyChannel: string;
    }) => void,
  ): (() => void) => {
    const handler = (
      _ev: IpcRendererEvent,
      payload: { batch: ScraperBatchRequest; replyChannel: string },
    ) => cb(payload);
    ipcRenderer.on("scraper:flush-batch", handler);
    return () => ipcRenderer.removeListener("scraper:flush-batch", handler);
  },

  replyFlush: (replyChannel: string, ok: boolean, error?: string): void => {
    ipcRenderer.send(replyChannel, { ok, error });
  },

  /**
   * Subscribe to the authoritative allowlist pushed by main after a
   * successful server fetch (F4). Replaces the legacy broadcast that
   * collided with the refresh-request channel.
   */
  onAllowlistSync: (
    cb: (entries: InsurerDomainAllowlistEntry[]) => void,
  ): (() => void) => {
    const handler = (
      _ev: IpcRendererEvent,
      entries: InsurerDomainAllowlistEntry[],
    ) => cb(entries);
    ipcRenderer.on("scraper:allowlist-sync", handler);
    return () =>
      ipcRenderer.removeListener("scraper:allowlist-sync", handler);
  },

  /**
   * Subscribe to compile rejections — main emits on this channel when
   * one or more allowlist rows fail static regex-safety or compilation.
   */
  onAllowlistError: (
    cb: (
      rejections: Array<{
        id: string;
        host_pattern: string;
        reason: "unsafe-regex" | "invalid-syntax";
      }>,
    ) => void,
  ): (() => void) => {
    const handler = (
      _ev: IpcRendererEvent,
      rejections: Array<{
        id: string;
        host_pattern: string;
        reason: "unsafe-regex" | "invalid-syntax";
      }>,
    ) => cb(rejections);
    ipcRenderer.on("scraper:allowlist-error", handler);
    return () =>
      ipcRenderer.removeListener("scraper:allowlist-error", handler);
  },

  setViewportBounds: (
    rect: { x: number; y: number; width: number; height: number } | null,
  ): void => {
    ipcRenderer.send("scraper:set-viewport-bounds", rect);
  },

  /**
   * Trigger-only after F4. Renderer no longer sends the allowlist; main
   * fetches it authoritatively and broadcasts back on
   * `scraper:allowlist-sync`. Returns `{ ok, error? }` so callers can
   * show a toast if the fetch fails.
   */
  refreshAllowlist: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("scraper:refresh-allowlist"),
});
