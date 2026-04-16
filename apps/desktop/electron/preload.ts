import { contextBridge, ipcRenderer } from "electron";

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
