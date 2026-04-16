import { app } from "electron";

export function initUpdater(): void {
  if (!app.isPackaged) {
    console.log("[Updater] Auto-updater disabled in development");
    return;
  }

  // Production auto-updater will be configured here when ready
  // Using electron-updater with GitHub releases
  console.log("[Updater] Auto-updater initialized");
}
