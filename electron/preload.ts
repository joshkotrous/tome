import { ConversationMessage, Database, Settings } from "@/types";
import { ipcRenderer, contextBridge } from "electron";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args)
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  // You can expose other APTs you need here.
  // ...
});

contextBridge.exposeInMainWorld("db", {
  listDatabases: () => ipcRenderer.invoke("db:listDatabases"),
  getDatabase: (id: number) => ipcRenderer.invoke("db:getDatabase", id),
  deleteDatabases: (ids: number[]) =>
    ipcRenderer.invoke("db:deleteDatabases", ids),
  updateDatabase: (id: number, values: Partial<Database>) =>
    ipcRenderer.invoke("db:updateDatabase", id, values),
  createDatabase: (values: Omit<Database, "id">) =>
    ipcRenderer.invoke("db:createDatabase", values),
  testConnection: (db: Omit<Database, "id">) =>
    ipcRenderer.invoke("db:testConnection", db),
  connect: (db: Database) => ipcRenderer.invoke("db:connect", db),
  disconnect: (db: Database) => ipcRenderer.invoke("db:disconnect", db),
  listActiveConnections: () => ipcRenderer.invoke("db:listActiveConnections"),
  listRemoteDatabases: (db: Database) =>
    ipcRenderer.invoke("db:listRemoteDatabases", db),
  listSchemas: (db: Database, targetDb?: string) =>
    ipcRenderer.invoke("db:listSchemas", db, targetDb),
  listSchemaTables: (db: Database, targetSchema: string, targetDb?: string) =>
    ipcRenderer.invoke("db:listSchemaTables", db, targetSchema, targetDb),
  query: (db: Database, sql: string, params: any[]) =>
    ipcRenderer.invoke("db:query", db, sql, params),
  getFullSchema: (db: Database, targetDb?: string) =>
    ipcRenderer.invoke("db:getFullSchema", db, targetDb),
});

contextBridge.exposeInMainWorld("settings", {
  getSettings: () => ipcRenderer.invoke("settings:getSettings"),
  updateSettings: (settings: Partial<Settings>) =>
    ipcRenderer.invoke("settings:updateSettings", settings),
});

contextBridge.exposeInMainWorld("messages", {
  createMessage: (values: Omit<ConversationMessage, "id" | "createdAt">) =>
    ipcRenderer.invoke("messages:createMessage", values),
  listMessages: (conversation: number) =>
    ipcRenderer.invoke("messages:listMessages", conversation),
});

contextBridge.exposeInMainWorld("conversations", {
  createConversation: (initialMessage: string) =>
    ipcRenderer.invoke("conversations:createConversation", initialMessage),
  listConversations: () =>
    ipcRenderer.invoke("conversations:listConversations"),
  deleteConversation: (conversation: number) =>
    ipcRenderer.invoke("conversations:deleteConversation", conversation),
});
