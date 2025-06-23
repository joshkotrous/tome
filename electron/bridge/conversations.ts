import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("conversations", {
  createConversation: (initialMessage: string) =>
    ipcRenderer.invoke("conversations:createConversation", initialMessage),
  listConversations: () =>
    ipcRenderer.invoke("conversations:listConversations"),
  deleteConversation: (conversation: number) =>
    ipcRenderer.invoke("conversations:deleteConversation", conversation),
  getConversation: (id: number) =>
    ipcRenderer.invoke("conversations:getConversation", id),
});
