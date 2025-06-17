import { contextBridge, ipcRenderer, Settings } from "electron";

contextBridge.exposeInMainWorld("settings", {
  getSettings: () => ipcRenderer.invoke("settings:getSettings"),
  updateSettings: (settings: Partial<Settings>) =>
    ipcRenderer.invoke("settings:updateSettings", settings),
});
