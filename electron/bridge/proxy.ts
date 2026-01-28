import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("proxy", {
  fetchStream: (url: string, options?: Record<string, unknown>) =>
    ipcRenderer.invoke("ai:proxy", { url, options }),
  cancelStream: (streamId: string) =>
    ipcRenderer.invoke("ai:cancel-stream", streamId),
});
