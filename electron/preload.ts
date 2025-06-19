import { ConversationMessage, Database, Settings } from "@/types";
import { ipcRenderer, contextBridge } from "electron";

// ---------------------------------------------------------------------------
// ⚠️  Secure IPC Exposure
// ---------------------------------------------------------------------------
// Only the channels listed below can be reached from the untrusted renderer.
// Anything else will be rejected at runtime to preserve the privilege boundary.
// ---------------------------------------------------------------------------
const ALLOWED_LISTEN_CHANNELS = new Set<string>([
  "main-process-message",
]);
const ALLOWED_SEND_CHANNELS = new Set<string>([]); // none for now
const ALLOWED_INVOKE_CHANNELS = new Set<string>([]); // none for now

function assertChannelAllowed(
  channel: string,
  allowed: Set<string>,
): void {
  if (!allowed.has(channel)) {
    throw new Error(`IPC channel “${channel}” is not permitted in renderer context`);
  }
}

// --------- Expose a minimal, vetted IPC bridge to the Renderer process -----
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    assertChannelAllowed(channel as string, ALLOWED_LISTEN_CHANNELS);
    return ipcRenderer.on(channel, (event, ...innerArgs) =>
      listener(event, ...innerArgs),
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel] = args;
    assertChannelAllowed(channel as string, ALLOWED_LISTEN_CHANNELS);
    return ipcRenderer.off(...args);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel] = args;
    assertChannelAllowed(channel as string, ALLOWED_SEND_CHANNELS);
    return ipcRenderer.send(...args);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel] = args;
    assertChannelAllowed(channel as string, ALLOWED_INVOKE_CHANNELS);
    return ipcRenderer.invoke(...args);
  },
});

// ---------------- Specific renderer APIs (already constrained) ------------
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
