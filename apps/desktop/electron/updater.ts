import { app, BrowserWindow } from "electron";
import pkg from "electron-updater";
const { autoUpdater } = pkg;

export function initUpdater(): void {
  if (!app.isPackaged) {
    console.log("[Updater] Auto-updater disabled in development");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[Updater] Checking for updates...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[Updater] Update available:", info.version);
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[Updater] App is up to date");
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log(`[Updater] Download: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[Updater] Update downloaded:", info.version);
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send("update-downloaded", info.version);
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("[Updater] Error:", err.message);
  });

  autoUpdater.checkForUpdatesAndNotify();
}
