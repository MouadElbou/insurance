import { app, BrowserWindow, Tray, Menu, nativeImage, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc-handlers";
import { initUpdater } from "./updater";
import { PortalManager } from "./portal-manager";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let portalManager: PortalManager | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.mjs"),
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Content Security Policy — applies only to our tracker app's main window.
  // The WebContentsView used for insurer portals runs on a separate session
  // partition (PORTAL_SESSION_PARTITION) and is NOT affected by this CSP.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          isDev
            ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* http://localhost:*; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://backend-production-ecde.up.railway.app wss://backend-production-ecde.up.railway.app; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com",
        ],
      },
    });
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Afficher",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quitter",
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Insurance Tracker");
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function createPortalManager() {
  portalManager = new PortalManager({
    // The renderer owns the JWT. Main asks the renderer to POST the batch with
    // the user's auth header, keeping tokens out of the main process.
    flushToBackend: async ({ window, batch }) => {
      if (!window || window.isDestroyed()) {
        throw new Error("Fenêtre principale indisponible");
      }
      await new Promise<void>((resolve, reject) => {
        const replyChannel = `scraper:flush-batch-reply:${batch.batch_id}`;
        const timeout = setTimeout(() => {
          window.webContents.ipc.removeAllListeners(replyChannel);
          reject(new Error("Délai dépassé pour le flush"));
        }, 30_000);
        window.webContents.ipc.once(replyChannel, (_ev, payload) => {
          clearTimeout(timeout);
          const { ok, error } = payload as { ok: boolean; error?: string };
          if (ok) resolve();
          else reject(new Error(error ?? "Échec du flush"));
        });
        window.webContents.send("scraper:flush-batch", { batch, replyChannel });
      });
    },
  });
  if (mainWindow) {
    portalManager.attachWindow(mainWindow);
  }
  return portalManager;
}

app.whenReady().then(() => {
  createWindow();
  const manager = createPortalManager();
  registerIpcHandlers({ getPortalManager: () => manager });
  createTray();
  initUpdater();
});

app.on("window-all-closed", () => {
  // On Windows, keep running in tray
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    if (portalManager && mainWindow) {
      portalManager.attachWindow(mainWindow);
    }
  }
});

app.on("before-quit", () => {
  (app as any).isQuitting = true;
});
