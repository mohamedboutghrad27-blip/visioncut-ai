/**
 * VisionCut AI desktop preload — the only bridge between the web app and
 * Electron. Exposes read-only app info; no Node APIs reach the page.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("visioncutDesktop", {
  isDesktop: true,
  getInfo: () => ipcRenderer.invoke("visioncut:info"),
});
