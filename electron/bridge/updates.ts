import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("updates", {
  checkForUpdates: () => ipcRenderer.invoke("updates:checkForUpdates"),
  downloadUpdate: () => ipcRenderer.invoke("updates:downloadUpdate"),
  installUpdate: () => ipcRenderer.invoke("updates:installUpdate"),
  getCurrentVersion: () => ipcRenderer.invoke("updates:getCurrentVersion"),
  getUpdateAvailable: () => ipcRenderer.invoke("updates:getUpdateAvailable"),
  // Event listeners for update status and progress
  onUpdateStatus: (callback: (data: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data);
    ipcRenderer.on("update-status", listener);
    return () => ipcRenderer.removeListener("update-status", listener);
  },
  onDownloadProgress: (callback: (data: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data);
    ipcRenderer.on("update-download-progress", listener);
    return () =>
      ipcRenderer.removeListener("update-download-progress", listener);
  },
});
