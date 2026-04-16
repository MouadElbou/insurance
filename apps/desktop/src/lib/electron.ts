export interface ElectronAPI {
  storeTokens(tokens: { access: string; refresh: string }): Promise<void>;
  getTokens(): Promise<{ access: string; refresh: string } | null>;
  clearTokens(): Promise<void>;
  getAppVersion(): Promise<string>;
  getPlatform(): string;
  minimizeToTray(): void;
  quitApp(): void;
}

const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;

export const isElectron = !!electronAPI;
export const electron = electronAPI;

// Safe fallbacks for browser dev mode
export async function storeTokens(tokens: {
  access: string;
  refresh: string;
}): Promise<void> {
  if (electronAPI) {
    await electronAPI.storeTokens(tokens);
  } else {
    localStorage.setItem("insurance_tokens", JSON.stringify(tokens));
  }
}

export async function getTokens(): Promise<{
  access: string;
  refresh: string;
} | null> {
  if (electronAPI) {
    return electronAPI.getTokens();
  }
  const stored = localStorage.getItem("insurance_tokens");
  return stored ? JSON.parse(stored) : null;
}

export async function clearTokens(): Promise<void> {
  if (electronAPI) {
    await electronAPI.clearTokens();
  } else {
    localStorage.removeItem("insurance_tokens");
  }
}

export function minimizeToTray(): void {
  if (electronAPI) {
    electronAPI.minimizeToTray();
  }
}

export function quitApp(): void {
  if (electronAPI) {
    electronAPI.quitApp();
  }
}
