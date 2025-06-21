import { TomeMessage } from "@/types";
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("messages", {
  createMessage: (values: Omit<TomeMessage, "id" | "createdAt">) =>
    ipcRenderer.invoke("messages:createMessage", values),
  listMessages: (conversation?: number, query?: number) =>
    ipcRenderer.invoke("messages:listMessages", conversation, query),
});
