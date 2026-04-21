/**
 * Network interception for the insurer-portal WebContentsView.
 *
 * Captures:
 *   - Request bodies via `session.webRequest.onBeforeRequest`
 *   - Response bodies via `webContents.debugger` attached to CDP Network domain
 *
 * Buffers captured events in memory. Flushes when:
 *   - buffer hits SCRAPER_BUFFER_THRESHOLD (20)
 *   - SCRAPER_FLUSH_INTERVAL_MS (5s) elapses
 *
 * The caller (portal-manager) provides the flush destination (IPC send -> renderer,
 * which then forwards to the backend via authenticated API).
 */
import type { Session, WebContentsView } from "electron";
import { randomUUID } from "node:crypto";
import {
  SCRAPER_HEADER_DROP_LIST,
  SCRAPER_HEADER_DROP_PREFIX,
  SCRAPER_LOGIN_URL_PATTERN,
  SCRAPER_BUFFER_THRESHOLD,
  SCRAPER_FLUSH_INTERVAL_MS,
  SCRAPER_MAX_BATCH_SIZE,
  SCRAPER_MAX_REQUEST_BODY_BYTES,
  SCRAPER_MAX_RESPONSE_BODY_BYTES,
} from "@insurance/shared";
import type {
  InsurerDomainAllowlistEntry,
  ScraperEventInput,
} from "@insurance/shared";
import {
  compileAllowlist,
  isHostCaptured,
  type AllowlistRejection,
  type CompiledAllowlistEntry,
} from "./allowlist.js";

interface InFlightRequest {
  method: string;
  url: string;
  host: string;
  pathname: string;
  requestBody: string | null;
  requestHeaders: Record<string, string> | null;
  startedAt: number;
}

export interface BatchToFlush {
  batch_id: string;
  events: ScraperEventInput[];
}

export interface NetworkInterceptorOptions {
  /** Called with a batch when the buffer flushes. Must not throw. */
  onFlush: (batch: BatchToFlush) => void | Promise<void>;
  /** Called whenever the captured counter changes. */
  onCounterChanged?: (totalCaptured: number) => void;
  /**
   * Called with the list of rows that failed compilation so the
   * renderer can surface a toast on `scraper:allowlist-error`. We
   * report, never throw — one broken row shouldn't take down capture
   * for the other insurers.
   */
  onAllowlistError?: (rejections: AllowlistRejection[]) => void;
}

export class NetworkInterceptor {
  private allowlist: CompiledAllowlistEntry[] = [];
  private readonly inFlight = new Map<string, InFlightRequest>();
  private readonly bodyBuffer = new Map<string, string>();
  private readonly events: ScraperEventInput[] = [];
  private capturedCount = 0;
  private debuggerAttached = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private detachFns: Array<() => void> = [];

  constructor(private readonly opts: NetworkInterceptorOptions) {}

  /**
   * Replace the current allowlist. Called on boot and after admin edits.
   *
   * Delegates to `compileAllowlist` in `./allowlist.js` so the portal
   * navigation guards (F1) and capture gate (here) share exactly one
   * compiled regex set — no drift possible.
   *
   * Rejections (unsafe regex, invalid syntax) are surfaced via
   * `opts.onAllowlistError` so the admin sees a toast and can fix the
   * row instead of wondering why capture silently dropped.
   */
  setAllowlist(entries: InsurerDomainAllowlistEntry[]) {
    const { compiled, rejected } = compileAllowlist(entries);
    this.allowlist = compiled;
    if (rejected.length > 0 && this.opts.onAllowlistError) {
      try {
        this.opts.onAllowlistError(rejected);
      } catch {
        /* never propagate subscriber errors back into capture path */
      }
    }
  }

  /** Access compiled allowlist (read-only) for handoff to PortalManager. */
  getCompiledAllowlist(): readonly CompiledAllowlistEntry[] {
    return this.allowlist;
  }

  /** Start intercepting on the given session + view. */
  attach(session: Session, view: WebContentsView) {
    this.attachWebRequest(session);
    this.attachDebugger(view);
    this.startFlushTimer();
  }

  /** Tear down all interception and flush any pending events. */
  async detach() {
    for (const fn of this.detachFns) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
    this.detachFns = [];
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    this.inFlight.clear();
    this.bodyBuffer.clear();
  }

  /** Test whether a host is allowlisted AND capture-enabled. */
  isCaptured(host: string): { matched: boolean; insurerCode: string | null } {
    const { captured, insurerCode } = isHostCaptured(host, this.allowlist);
    return { matched: captured, insurerCode };
  }

  private attachWebRequest(session: Session) {
    const handler = (
      details: Electron.OnBeforeRequestListenerDetails,
      callback: (response: Electron.BeforeRequestResponse) => void,
    ) => {
      try {
        const parsed = this.parseUrl(details.url);
        if (!parsed) return callback({});
        const { host, pathname } = parsed;
        if (!this.isCaptured(host).matched) return callback({});

        const method = details.method ?? "GET";
        const uploadData = details.uploadData;
        let requestBody: string | null = null;
        if (uploadData && uploadData.length > 0) {
          try {
            const combined = Buffer.concat(
              uploadData
                .map((d) => d.bytes)
                .filter((b): b is Buffer => Buffer.isBuffer(b)),
            );
            if (combined.byteLength <= SCRAPER_MAX_REQUEST_BODY_BYTES) {
              requestBody = combined.toString("utf-8");
            } else {
              requestBody = `[TRUNCATED: ${combined.byteLength} bytes]`;
            }
          } catch {
            requestBody = null;
          }
          if (
            requestBody &&
            SCRAPER_LOGIN_URL_PATTERN.test(details.url)
          ) {
            requestBody = "[REDACTED]";
          }
        }

        this.inFlight.set(String(details.id), {
          method,
          url: details.url,
          host,
          pathname,
          requestBody,
          requestHeaders: null, // populated on response via CDP
          startedAt: Date.now(),
        });
      } catch {
        // Never block the request because of capture bugs.
      }
      callback({});
    };
    session.webRequest.onBeforeRequest(handler);
    this.detachFns.push(() => {
      session.webRequest.onBeforeRequest(null);
    });
  }

  private attachDebugger(view: WebContentsView) {
    const wc = view.webContents;
    try {
      wc.debugger.attach("1.3");
      this.debuggerAttached = true;
    } catch {
      // If already attached or unavailable, continue without response bodies
      this.debuggerAttached = false;
      return;
    }

    wc.debugger
      .sendCommand("Network.enable", {
        maxResourceBufferSize: 2 * 1024 * 1024,
        maxTotalBufferSize: 20 * 1024 * 1024,
      })
      .catch(() => {
        /* ignore */
      });

    const onMessage = (
      _event: Electron.Event,
      method: string,
      params: Record<string, unknown>,
    ) => {
      void this.handleCdpMessage(wc, method, params);
    };
    wc.debugger.on("message", onMessage);

    this.detachFns.push(() => {
      try {
        wc.debugger.off("message", onMessage);
      } catch {
        /* ignore */
      }
      if (this.debuggerAttached) {
        try {
          wc.debugger.detach();
        } catch {
          /* ignore */
        }
        this.debuggerAttached = false;
      }
    });
  }

  private async handleCdpMessage(
    wc: Electron.WebContents,
    method: string,
    params: Record<string, unknown>,
  ) {
    try {
      if (method === "Network.requestWillBeSent") {
        // Use CDP request IDs keyed by url as fallback when onBeforeRequest id != CDP requestId
        const p = params as {
          requestId: string;
          request: { url: string; method: string; headers: Record<string, string> };
        };
        // Stash request headers under url-based key so we can reconcile later
        this.bodyBuffer.set(`h:${p.requestId}`, JSON.stringify(p.request.headers ?? {}));
      }

      if (method === "Network.responseReceived") {
        const p = params as {
          requestId: string;
          response: {
            url: string;
            status: number;
            headers: Record<string, string>;
            mimeType: string;
          };
        };
        // Store response metadata for later pair-up when loadingFinished fires
        this.bodyBuffer.set(
          `r:${p.requestId}`,
          JSON.stringify({
            status: p.response.status,
            headers: p.response.headers ?? {},
            mimeType: p.response.mimeType,
            url: p.response.url,
          }),
        );
      }

      if (method === "Network.loadingFinished") {
        const p = params as { requestId: string };
        await this.finalizeEvent(wc, p.requestId);
      }

      if (method === "Network.loadingFailed") {
        const p = params as { requestId: string; errorText?: string };
        await this.finalizeEvent(wc, p.requestId, p.errorText ?? "network error");
      }
    } catch {
      // Never let CDP handler exceptions escape
    }
  }

  private async finalizeEvent(
    wc: Electron.WebContents,
    requestId: string,
    errorText?: string,
  ) {
    const metaJson = this.bodyBuffer.get(`r:${requestId}`);
    const headersJson = this.bodyBuffer.get(`h:${requestId}`);
    this.bodyBuffer.delete(`r:${requestId}`);
    this.bodyBuffer.delete(`h:${requestId}`);

    if (!metaJson) return; // missing response meta; skip

    const meta = JSON.parse(metaJson) as {
      status: number;
      headers: Record<string, string>;
      mimeType: string;
      url: string;
    };
    const reqHeaders = headersJson
      ? (JSON.parse(headersJson) as Record<string, string>)
      : {};

    const parsed = this.parseUrl(meta.url);
    if (!parsed) return;
    const { host, pathname } = parsed;
    const { matched } = this.isCaptured(host);
    if (!matched) return;

    let responseBody: string | null = null;
    if (!errorText) {
      try {
        const { body, base64Encoded } = (await wc.debugger.sendCommand(
          "Network.getResponseBody",
          { requestId },
        )) as { body: string; base64Encoded: boolean };
        const raw = base64Encoded
          ? Buffer.from(body, "base64").toString("utf-8")
          : body;
        if (raw.length <= SCRAPER_MAX_RESPONSE_BODY_BYTES) {
          responseBody = raw;
        } else {
          responseBody = `[TRUNCATED: ${raw.length} bytes]`;
        }
      } catch {
        responseBody = null;
      }
    }

    // Find matching in-flight by URL (Electron request ID != CDP request ID)
    let match: { key: string; entry: InFlightRequest } | null = null;
    for (const [k, v] of this.inFlight.entries()) {
      if (v.url === meta.url) {
        match = { key: k, entry: v };
        break;
      }
    }
    if (match) {
      this.inFlight.delete(match.key);
    }

    const method =
      match?.entry.method ??
      (reqHeaders[":method"] ?? reqHeaders["method"] ?? "GET");
    const startedAt = match?.entry.startedAt ?? Date.now();

    const event: ScraperEventInput = {
      method,
      url: meta.url,
      host,
      pathname,
      status_code: errorText ? null : meta.status,
      request_headers: this.sanitizeHeaders(reqHeaders),
      response_headers: this.sanitizeHeaders(meta.headers),
      request_body: match?.entry.requestBody ?? null,
      response_body: responseBody,
      captured_at: new Date(startedAt).toISOString(),
      duration_ms: Math.max(0, Date.now() - startedAt),
    };

    this.enqueue(event);
  }

  private enqueue(event: ScraperEventInput) {
    this.events.push(event);
    this.capturedCount += 1;
    this.opts.onCounterChanged?.(this.capturedCount);
    if (this.events.length >= SCRAPER_BUFFER_THRESHOLD) {
      void this.flush();
    }
  }

  private async flush() {
    if (this.events.length === 0) return;
    // Take up to SCRAPER_MAX_BATCH_SIZE events per batch
    while (this.events.length > 0) {
      const batch = this.events.splice(0, SCRAPER_MAX_BATCH_SIZE);
      try {
        await this.opts.onFlush({
          batch_id: randomUUID(),
          events: batch,
        });
      } catch {
        // Caller handles retry; if it throws we drop silently to avoid loops.
      }
    }
  }

  private startFlushTimer() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(
      () => void this.flush(),
      SCRAPER_FLUSH_INTERVAL_MS,
    );
  }

  private parseUrl(urlString: string): { host: string; pathname: string } | null {
    try {
      const u = new URL(urlString);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return { host: u.hostname, pathname: u.pathname };
    } catch {
      return null;
    }
  }

  private sanitizeHeaders(
    headers: Record<string, string> | null | undefined,
  ): Record<string, string> | null {
    if (!headers) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      const lower = k.toLowerCase();
      if (SCRAPER_HEADER_DROP_LIST.has(lower)) continue;
      if (SCRAPER_HEADER_DROP_PREFIX.test(lower)) continue;
      if (typeof v !== "string") continue;
      out[k] = v;
    }
    return out;
  }
}
