/**
 * Intentionally empty preload for the insurer-portal WebContentsView.
 *
 * The portal page is third-party. It must NOT be able to reach any Electron
 * APIs, IPC channels, or our tracker app's internals. We keep this file as a
 * placeholder so the build pipeline has a stable entry, but do not expose any
 * `contextBridge` surface.
 *
 * DO NOT add `contextBridge.exposeInMainWorld(...)` here.
 */

export {};
