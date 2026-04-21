import { ipcMain, safeStorage, app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  insurerDomainAllowlistEntrySchema,
  type InsurerDomainAllowlistEntry,
} from "@insurance/shared";
import type { PortalManager } from "./portal-manager";

const TOKENS_FILE = "tokens.dat";
// F4 — main-side fetch base URL. Vite env vars (`VITE_*`) live only in
// the renderer bundle, so main reads the runtime override explicitly.
const DEFAULT_API_URL = "http://localhost:3001";

function getApiUrl(): string {
  return process.env.VITE_API_URL?.trim() || DEFAULT_API_URL;
}

function getTokensPath(): string {
  return path.join(app.getPath("userData"), TOKENS_FILE);
}

interface StoredTokens {
  access: string;
  refresh: string;
}

/**
 * Read and decrypt the tokens file. Shared by `tokens:get` and the
 * F4 allowlist fetch — the latter needs the access JWT to authenticate
 * to the backend without bouncing through the renderer (the renderer
 * would have to expose its JWT back over IPC, and we don't want to
 * widen the preload surface).
 */
function readStoredTokens(): StoredTokens | null {
  const tokensPath = getTokensPath();
  if (!fs.existsSync(tokensPath)) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = fs.readFileSync(tokensPath);
      const decrypted = safeStorage.decryptString(encrypted);
      return JSON.parse(decrypted) as StoredTokens;
    }
    const raw = fs.readFileSync(tokensPath, "utf-8");
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

interface RegisterIpcHandlersDeps {
  /** Resolve the PortalManager lazily — the manager may be reconstructed on activate. */
  getPortalManager: () => PortalManager | null;
}

// Shape the backend returns on GET /api/v1/scraper/insurer-domains —
// may be a bare array or a `{ data: [...] }` envelope depending on
// wrapping middleware, so accept both and normalise.
const allowlistResponseSchema = z.union([
  z.array(insurerDomainAllowlistEntrySchema),
  z.object({ data: z.array(insurerDomainAllowlistEntrySchema) }),
]);

export function registerIpcHandlers(deps: RegisterIpcHandlersDeps) {
  const { getPortalManager } = deps;

  // ------------------------------------------------------------------ //
  // Auth token storage (safeStorage-encrypted when available)
  // ------------------------------------------------------------------ //
  ipcMain.handle(
    "tokens:store",
    async (_event, tokens: { access: string; refresh: string }) => {
      const tokensPath = getTokensPath();
      const raw = JSON.stringify(tokens);

      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(raw);
        fs.writeFileSync(tokensPath, encrypted);
      } else {
        // Fallback: plain storage (development only)
        fs.writeFileSync(tokensPath, raw, "utf-8");
      }
    },
  );

  ipcMain.handle("tokens:get", async () => {
    const tokens = readStoredTokens();
    if (tokens) return tokens;
    // If the file exists but reading failed, unlink so the next write
    // starts from a clean slate. We swallow unlink errors because the
    // caller just wants null-or-tokens back.
    const tokensPath = getTokensPath();
    if (fs.existsSync(tokensPath)) {
      try {
        fs.unlinkSync(tokensPath);
      } catch {
        /* ignore */
      }
    }
    return null;
  });

  ipcMain.handle("tokens:clear", async () => {
    const tokensPath = getTokensPath();
    if (fs.existsSync(tokensPath)) {
      fs.unlinkSync(tokensPath);
    }
  });

  ipcMain.handle("app:version", async () => {
    return app.getVersion();
  });

  ipcMain.on("window:minimize-to-tray", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.hide();
  });

  ipcMain.on("window:quit", () => {
    (app as any).isQuitting = true;
    app.quit();
  });

  // ------------------------------------------------------------------ //
  // Scraper / portal IPC
  // ------------------------------------------------------------------ //

  ipcMain.handle(
    "scraper:open-portal",
    async (
      _event,
      args: { insurer_code: string; start_url: string },
    ): Promise<{ ok: boolean; error?: string }> => {
      const manager = getPortalManager();
      if (!manager) {
        return { ok: false, error: "Gestionnaire de portail non initialisé" };
      }
      try {
        await manager.open(args);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Échec de l'ouverture",
        };
      }
    },
  );

  ipcMain.handle(
    "scraper:close-portal",
    async (): Promise<{ ok: boolean; error?: string }> => {
      const manager = getPortalManager();
      if (!manager) {
        return { ok: true };
      }
      try {
        await manager.close();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Échec de la fermeture",
        };
      }
    },
  );

  ipcMain.handle("scraper:get-status", async () => {
    const manager = getPortalManager();
    if (!manager) return null;
    return manager.getStatus();
  });

  // Renderer publishes the current bounding rect of PortalViewport (DIPs)
  ipcMain.on(
    "scraper:set-viewport-bounds",
    (
      _event,
      rect: { x: number; y: number; width: number; height: number } | null,
    ) => {
      const manager = getPortalManager();
      if (!manager) return;
      manager.setViewportBounds(rect);
    },
  );

  // F4 — renderer asks main to refresh the allowlist. Main:
  //   1. Reads the access token from the safeStorage-backed tokens file
  //      directly (no IPC round-trip to the renderer).
  //   2. Fetches `${API_URL}/api/v1/scraper/insurer-domains` with
  //      `Authorization: Bearer <access>`.
  //   3. Validates the response with
  //      `insurerDomainAllowlistEntrySchema.array()` — unsafe/invalid
  //      `host_pattern` regexes are rejected here (and again inside
  //      `compileAllowlist`) before any RegExp constructor runs.
  //   4. Calls `PortalManager.setAllowlist`, which broadcasts the
  //      validated list on `scraper:allowlist-sync` and any compile
  //      rejections on `scraper:allowlist-error`.
  //
  // The renderer becomes trigger-only: it cannot poison the allowlist
  // by IPC-spoofing a malicious patterns list, because main fetches
  // authoritatively. Returning `{ ok, error? }` lets the renderer show
  // a toast on network/auth failure without parsing error strings.
  ipcMain.handle(
    "scraper:refresh-allowlist",
    async (): Promise<{ ok: boolean; error?: string }> => {
      const manager = getPortalManager();
      if (!manager) {
        return { ok: false, error: "Gestionnaire de portail non initialisé" };
      }

      const tokens = readStoredTokens();
      if (!tokens?.access) {
        return { ok: false, error: "Session expirée — reconnectez-vous" };
      }

      let response: Response;
      try {
        response = await fetch(
          `${getApiUrl()}/api/v1/scraper/insurer-domains`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${tokens.access}`,
              Accept: "application/json",
            },
          },
        );
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? `Réseau: ${err.message}`
              : "Erreur réseau inconnue",
        };
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { ok: false, error: "Non autorisé — reconnectez-vous" };
        }
        return {
          ok: false,
          error: `Réponse backend ${response.status}`,
        };
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return { ok: false, error: "Réponse JSON invalide" };
      }

      const parsed = allowlistResponseSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          error: "Schéma de réponse allowlist invalide",
        };
      }

      const entries: InsurerDomainAllowlistEntry[] = Array.isArray(parsed.data)
        ? parsed.data
        : parsed.data.data;
      manager.setAllowlist(entries);
      return { ok: true };
    },
  );
}
