import { ipcMain, safeStorage, app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";

const TOKENS_FILE = "tokens.dat";

function getTokensPath(): string {
  return path.join(app.getPath("userData"), TOKENS_FILE);
}

export function registerIpcHandlers() {
  // Store tokens — encrypt with safeStorage if available
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

  // Get tokens — decrypt with safeStorage if available
  ipcMain.handle("tokens:get", async () => {
    const tokensPath = getTokensPath();

    if (!fs.existsSync(tokensPath)) {
      return null;
    }

    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = fs.readFileSync(tokensPath);
        const decrypted = safeStorage.decryptString(encrypted);
        return JSON.parse(decrypted);
      } else {
        const raw = fs.readFileSync(tokensPath, "utf-8");
        return JSON.parse(raw);
      }
    } catch {
      // If decryption fails, remove corrupted file
      fs.unlinkSync(tokensPath);
      return null;
    }
  });

  // Clear tokens
  ipcMain.handle("tokens:clear", async () => {
    const tokensPath = getTokensPath();
    if (fs.existsSync(tokensPath)) {
      fs.unlinkSync(tokensPath);
    }
  });

  // App version
  ipcMain.handle("app:version", async () => {
    return app.getVersion();
  });

  // Window minimize to tray
  ipcMain.on("window:minimize-to-tray", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.hide();
  });

  // Quit app
  ipcMain.on("window:quit", () => {
    (app as any).isQuitting = true;
    app.quit();
  });
}
