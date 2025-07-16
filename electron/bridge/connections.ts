import { Connection } from "@/types";
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("connections", {
  listConnections: () => ipcRenderer.invoke("connections:listConnections"),
  getConnection: (id: number) =>
    ipcRenderer.invoke("connections:getConnection", id),
  deleteConnections: (ids: number[]) =>
    ipcRenderer.invoke("connections:deleteConnections", ids),
  updateConnection: (id: number, values: Partial<Connection>) =>
    ipcRenderer.invoke("connections:updateConnection", id, values),
  createConnection: (values: Omit<Connection, "id">) =>
    ipcRenderer.invoke("connections:createConnection", values),
  testConnection: (db: Omit<Connection, "id">) =>
    ipcRenderer.invoke("connections:testConnection", db),
  connect: (db: Connection) => ipcRenderer.invoke("connections:connect", db),
  disconnect: (db: Connection) =>
    ipcRenderer.invoke("connections:disconnect", db),
  listActiveConnections: () =>
    ipcRenderer.invoke("connections:listActiveConnections"),
  listRemoteDatabases: (db: Connection) =>
    ipcRenderer.invoke("connections:listRemoteDatabases", db),
  listSchemas: (db: Connection, targetDb?: string) =>
    ipcRenderer.invoke("connections:listSchemas", db, targetDb),
  listSchemaTables: (db: Connection, targetSchema: string, targetDb?: string) =>
    ipcRenderer.invoke(
      "connections:listSchemaTables",
      db,
      targetSchema,
      targetDb
    ),
  query: (db: Connection, sql: string, params: any[]) =>
    ipcRenderer.invoke("connections:query", db, sql, params),
  getFullSchema: (db: Connection, targetDb?: string) =>
    ipcRenderer.invoke("connections:getFullSchema", db, targetDb),
  getConnectionSchema: (connection: Connection) =>
    ipcRenderer.invoke("connections:getConnectionSchema", connection),
  getSampleDatabasePath: () =>
    ipcRenderer.invoke("connections:getSampleDatabasePath"),
});
