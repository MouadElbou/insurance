/**
 * Portal manager — owns the single WebContentsView that hosts the insurer portal.
 *
 * Responsibilities:
 *   - Open/close the embedded portal pointed at an InsurerDomain
 *   - Own a NetworkInterceptor that captures requests + responses
 *   - Forward captured batches to the renderer via IPC; the renderer then POSTs
 *     them to the authenticated backend API (re-using the app's JWT).
 *   - Broadcast status/counter updates to the renderer.
 *
 * The WebContentsView is docked underneath the main window's React content.
 * The renderer reserves a viewport via PortalViewport's bounding rect, and we
 * position the view to match on window resize.
 */
import {
  BrowserWindow,
  WebContentsView,
  session as sessionNs,
  ipcMain,
  app,
} from "electron";
import type { Rectangle } from "electron";
import {
  PORTAL_SESSION_PARTITION,
  SCRAPER_RETRY_BACKOFF_MS,
} from "@insurance/shared";
import type {
  CaptureStatus,
  InsurerDomainAllowlistEntry,
  PortalStatus,
  ScraperEventInput,
} from "@insurance/shared";
import { NetworkInterceptor, type BatchToFlush } from "./network-interceptor.js";
import {
  compileAllowlist,
  isHostAllowed,
  type AllowlistRejection,
  type CompiledAllowlistEntry,
} from "./allowlist.js";

export interface OpenPortalArgs {
  insurer_code: string;
  start_url: string;
}

export interface PortalManagerOptions {
  /** Called when the manager has a batch ready. Must resolve after successful POST. */
  flushToBackend: (args: {
    window: BrowserWindow;
    batch: BatchToFlush;
  }) => Promise<void>;
}

const STATUS_CHANNEL = "scraper:portal-status";
// Renderer fires this (ipcMain.handle) to trigger a main-side refresh (F4).
const ALLOWLIST_REFRESH_REQUEST_CHANNEL = "scraper:refresh-allowlist";
// Main broadcasts the compiled list back for renderer UI — kept distinct
// from the request channel so the handle/send contracts don't collide.
const ALLOWLIST_SYNC_CHANNEL = "scraper:allowlist-sync";
// Emitted when one or more rows fail to compile; renderer shows a toast.
const ALLOWLIST_ERROR_CHANNEL = "scraper:allowlist-error";

export class PortalManager {
  private window: BrowserWindow | null = null;
  private view: WebContentsView | null = null;
  private interceptor: NetworkInterceptor | null = null;
  private allowlist: InsurerDomainAllowlistEntry[] = [];
  private compiledAllowlist: CompiledAllowlistEntry[] = [];
  private status: PortalStatus = {
    status: "IDLE",
    insurer_code: null,
    url: null,
    captured_count: 0,
    last_flush_at: null,
    last_error: null,
  };
  private resizeHandler: (() => void) | null = null;
  private reservedBounds: Rectangle | null = null;
  private pendingRetries: BatchToFlush[] = [];

  constructor(private readonly opts: PortalManagerOptions) {}

  attachWindow(win: BrowserWindow) {
    this.window = win;
  }

  /**
   * Replace the allowlist. Input is the validated, server-fetched
   * payload (see F4 — main-side fetch). The renderer never handles
   * the raw patterns any more.
   */
  setAllowlist(list: InsurerDomainAllowlistEntry[]) {
    this.allowlist = list;
    const { compiled, rejected } = compileAllowlist(list);
    this.compiledAllowlist = compiled;
    this.interceptor?.setAllowlist(list);
    if (this.window) {
      // Broadcast the raw list (no compiled RegExp objects — those
      // don't survive structured-clone to the renderer anyway).
      this.window.webContents.send(ALLOWLIST_SYNC_CHANNEL, list);
      if (rejected.length > 0) {
        this.window.webContents.send(ALLOWLIST_ERROR_CHANNEL, rejected);
      }
    }
  }

  getAllowlist(): ReadonlyArray<InsurerDomainAllowlistEntry> {
    return this.allowlist;
  }

  getStatus(): PortalStatus {
    return { ...this.status };
  }

  /**
   * Renderer calls this when the PortalViewport is mounted and whenever it resizes.
   * Coordinates are in DIPs relative to the BrowserWindow's contentView.
   */
  setViewportBounds(bounds: Rectangle | null) {
    this.reservedBounds = bounds;
    if (this.view && bounds) {
      this.view.setBounds(bounds);
    }
  }

  async open(args: OpenPortalArgs): Promise<void> {
    if (!this.window) {
      throw new Error("Fenêtre principale non initialisée");
    }
    await this.closeInternal();

    const compiledEntry = this.compiledAllowlist.find(
      (e) => e.insurer_code === args.insurer_code && e.capture_enabled,
    );
    if (!compiledEntry) {
      // Reset counters: `closeInternal()` above tore down the prior view,
      // but did not touch the status object. Preserving captured_count /
      // last_flush_at here would make the ERROR state look like an active
      // session (e.g. badge "Erreur" next to "46 capturés / dernier envoi
      // il y a 5 min") — counters from the torn-down session the operator
      // just replaced.
      this.setStatus({
        status: "ERROR",
        insurer_code: args.insurer_code,
        url: null,
        captured_count: 0,
        last_flush_at: null,
        last_error: "Assureur non autorisé ou capture désactivée",
      });
      throw new Error("Assureur non autorisé");
    }

    // F2 — server-side authoritative URL validation. Renderer may echo
    // this check for UX but cannot be trusted (devtools, IPC spoofing,
    // renderer bugs). Reject any URL whose host doesn't match the
    // compiled host_pattern regex for the selected insurer.
    let targetHost: string;
    try {
      const parsed = new URL(args.start_url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("protocol");
      }
      targetHost = parsed.host;
    } catch {
      this.setStatus({
        status: "ERROR",
        insurer_code: args.insurer_code,
        url: args.start_url,
        captured_count: 0,
        last_flush_at: null,
        last_error: "URL invalide",
      });
      throw new Error("URL invalide");
    }
    if (!compiledEntry.pattern.test(targetHost)) {
      this.setStatus({
        status: "ERROR",
        insurer_code: args.insurer_code,
        url: args.start_url,
        captured_count: 0,
        last_flush_at: null,
        last_error: "URL non autorisée pour cet assureur",
      });
      throw new Error("URL non autorisée pour cet assureur");
    }

    this.setStatus({
      status: "OPENING",
      insurer_code: args.insurer_code,
      url: args.start_url,
      captured_count: 0,
      last_flush_at: null,
      last_error: null,
    });

    const partitionSession = sessionNs.fromPartition(PORTAL_SESSION_PARTITION);
    // Good-citizen UA: identify as Chromium, not Electron
    partitionSession.setUserAgent(
      `Mozilla/5.0 (${process.platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 InsuranceTracker/${app.getVersion()}`,
    );

    this.interceptor = new NetworkInterceptor({
      onFlush: (batch) => this.handleFlush(batch),
      onCounterChanged: (n) =>
        this.setStatus({ ...this.status, captured_count: n }),
    });
    this.interceptor.setAllowlist(this.allowlist);

    this.view = new WebContentsView({
      webPreferences: {
        session: partitionSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        // No preload — the portal page is third-party and must not reach our app APIs.
      },
    });

    // Dock the view underneath the React chrome
    this.window.contentView.addChildView(this.view);
    if (this.reservedBounds) {
      this.view.setBounds(this.reservedBounds);
    } else {
      const wb = this.window.getContentBounds();
      this.view.setBounds({ x: 0, y: 0, width: wb.width, height: wb.height });
    }

    // Re-dock on window resize
    this.resizeHandler = () => {
      if (this.reservedBounds && this.view) {
        this.view.setBounds(this.reservedBounds);
      }
    };
    this.window.on("resize", this.resizeHandler);

    // Update status on navigation events
    this.view.webContents.on("did-navigate", (_e, url) => {
      this.setStatus({
        ...this.status,
        url,
        status: "CAPTURING",
      });
    });
    this.view.webContents.on("did-navigate-in-page", (_e, url) => {
      this.setStatus({ ...this.status, url });
    });
    this.view.webContents.on(
      "did-fail-load",
      (_e, code, _desc, _url, isMainFrame) => {
        // Sub-frame failures on a third-party portal are routine noise
        // (tracking pixels, optional iframes); only react to top-level
        // failures. ERR_ABORTED (-3) just means a navigation was
        // superseded — benign.
        if (!isMainFrame || code === -3) return;
        // Any remaining failure means Chromium rendered its own
        // "This site can't be reached" page INSIDE the WebContentsView.
        // That is already the signal the operator needs — some portals
        // (notably CAT at tpv2.cat.co.ma:4439) require the operator to
        // start a local agent BEFORE the URL is reachable, so the
        // correct flow is "see error page → start local server → reload".
        // Piling on an app-level ERROR status + toast misrepresents a
        // transient remote condition as a portal crash.
      },
    );

    // F1 — navigation guards. The portal page is third-party and fully
    // sandboxed, but the allowlist is still the authoritative gate on
    // what origins its top-level/child windows are allowed to reach.
    // Any target URL whose host doesn't match a compiled, capture-agnostic
    // allowlist entry is denied at the Electron layer *before* the
    // request is issued. This protects against:
    //   - user-initiated navigation (typed URL / submitted form)
    //   - server-side redirects to off-allowlist hosts
    //   - `window.open(...)` / target="_blank" in portal pages
    // `isHostAllowed` ignores `capture_enabled` on purpose — a broker
    // can still *browse* an insurer's domain with capture paused; only
    // off-allowlist origins are blocked.
    this.view.webContents.setWindowOpenHandler(({ url }) => {
      const { ok } = isHostAllowed(url, this.compiledAllowlist);
      if (!ok) {
        this.setStatus({
          ...this.status,
          last_error: `Nouvelle fenêtre bloquée: ${url}`,
        });
      }
      // Always deny — we never want portal pages to spawn detached
      // windows outside the managed WebContentsView.
      return { action: "deny" };
    });
    this.view.webContents.on("will-navigate", (event, url) => {
      if (!isHostAllowed(url, this.compiledAllowlist).ok) {
        event.preventDefault();
        this.setStatus({
          ...this.status,
          last_error: `Navigation bloquée: ${url}`,
        });
      }
    });
    this.view.webContents.on("will-redirect", (event, url) => {
      if (!isHostAllowed(url, this.compiledAllowlist).ok) {
        event.preventDefault();
        this.setStatus({
          ...this.status,
          last_error: `Redirection bloquée: ${url}`,
        });
      }
    });

    this.interceptor.attach(partitionSession, this.view);
    this.setStatus({ ...this.status, status: "OPEN" });

    try {
      await this.view.webContents.loadURL(args.start_url);
      this.setStatus({ ...this.status, status: "CAPTURING" });
    } catch (err) {
      // loadURL rejects on any network-level failure before a response
      // reaches Chromium — DNS failure, connection refused, or an operator
      // who hasn't started their local dependency yet (CAT's
      // tpv2.cat.co.ma:4439 requires a broker-side agent running first).
      // Chromium already renders its own error page INSIDE the view, which
      // is the signal the operator needs. Surfacing a second app-level
      // toast misrepresents a transient remote condition as a portal crash
      // and blocks the natural "start local server → reload" recovery.
      // Keep status at OPEN and swallow so the IPC envelope is { ok: true }.
      void err;
    }
  }

  async close(): Promise<void> {
    await this.closeInternal();
    this.setStatus({
      ...this.status,
      status: "CLOSED",
      url: null,
    });
  }

  private async closeInternal() {
    if (this.resizeHandler && this.window) {
      this.window.off("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.interceptor) {
      await this.interceptor.detach();
      this.interceptor = null;
    }
    if (this.view && this.window) {
      try {
        this.window.contentView.removeChildView(this.view);
      } catch {
        // ignore
      }
      try {
        this.view.webContents.close();
      } catch {
        // ignore
      }
      this.view = null;
    }
  }

  private async handleFlush(batch: BatchToFlush): Promise<void> {
    if (!this.window) return;
    let attempts = 0;
    let delay = 0;
    const maxAttempts = SCRAPER_RETRY_BACKOFF_MS.length + 1;
    while (attempts < maxAttempts) {
      try {
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
        await this.opts.flushToBackend({ window: this.window, batch });
        this.setStatus({
          ...this.status,
          last_flush_at: new Date().toISOString(),
          last_error: null,
        });
        return;
      } catch (err) {
        attempts += 1;
        delay = SCRAPER_RETRY_BACKOFF_MS[attempts - 1] ?? 30_000;
        if (attempts >= maxAttempts) {
          this.setStatus({
            ...this.status,
            last_error:
              err instanceof Error
                ? `Échec du flush: ${err.message}`
                : "Échec du flush",
          });
          // Push to dead-letter queue — caller can inspect later; we don't grow unbounded.
          if (this.pendingRetries.length < 100) {
            this.pendingRetries.push(batch);
          }
          return;
        }
      }
    }
  }

  private setStatus(next: PortalStatus) {
    this.status = next;
    if (this.window) {
      this.window.webContents.send(STATUS_CHANNEL, next);
    }
  }
}

/** Convenience: broadcast a status-only update from outside the class. */
export function broadcastStatus(
  window: BrowserWindow | null,
  payload: Partial<PortalStatus> & { status: CaptureStatus },
) {
  window?.webContents.send(STATUS_CHANNEL, payload);
}

/** Used by ipc-handlers to bind viewport-bounds IPC before the manager exists. */
export const PORTAL_VIEWPORT_BOUNDS_CHANNEL = "scraper:set-viewport-bounds";
export const PORTAL_EVENTS_FLUSH_CHANNEL = "scraper:flush-batch";
export const PORTAL_STATUS_CHANNEL = STATUS_CHANNEL;
// F4 — renderer invokes this (ipcMain.handle) to ask main to re-fetch
// the allowlist from the backend and push it to the PortalManager.
export const PORTAL_ALLOWLIST_REFRESH_REQUEST_CHANNEL =
  ALLOWLIST_REFRESH_REQUEST_CHANNEL;
// Main broadcasts on these so the renderer can sync the table / show
// a toast when a row fails to compile.
export const PORTAL_ALLOWLIST_SYNC_CHANNEL = ALLOWLIST_SYNC_CHANNEL;
export const PORTAL_ALLOWLIST_ERROR_CHANNEL = ALLOWLIST_ERROR_CHANNEL;

// Silence unused warnings if consumer doesn't use ipcMain directly.
void ipcMain;
void (null as unknown as ScraperEventInput);
void (null as unknown as AllowlistRejection);
