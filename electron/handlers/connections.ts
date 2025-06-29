import {
  connect,
  createConnection,
  deleteConnections,
  disconnect,
  getConnection,
  getConnectionSchema,
  getFullSchema,
  listActive,
  listConnections,
  listRemoteDatabases,
  listSchemas,
  listSchemaTables,
  query,
  testConnection,
  updateConnection,
} from "../../core/connections";
import { Connection as ConnectionType } from "../../src/types";
import { ipcMain, IpcMainInvokeEvent } from "electron";

// Helper function to check authorization
function isAuthorized(event: IpcMainInvokeEvent): boolean {
  // Implement your authorization logic here
  // For example, check event.senderFrame.url or event.sender.id or a token
  // Here we do a simple check for demonstration (allow only if sender is not null)
  // In production, replace with proper auth check
  const sender = event.sender;
  if (!sender) {
    return false;
  }
  // Example: allow only if sender's URL is from trusted origin
  // const url = event.senderFrame.url;
  // return url.startsWith('app://');
  return true;
}

ipcMain.handle("connections:listConnections", async (event) => {
  if (!isAuthorized(event)) {
    throw new Error("Unauthorized access to listConnections");
  }
  try {
    const databases = await listConnections();
    return databases;
  } catch (err) {
    console.error("Failed to list databases:", err);
    throw err;
  }
});

ipcMain.handle("connections:getConnection", async (event, id: number) => {
  if (!isAuthorized(event)) {
    throw new Error("Unauthorized access to getConnection");
  }
  try {
    const database = await getConnection(id);
    return database;
  } catch (err) {
    console.error("Failed to get database:", err);
    throw err;
  }
});

ipcMain.handle(
  "connections:deleteConnections",
  async (event, ids: number[]) => {
    if (!isAuthorized(event)) {
      throw new Error("Unauthorized access to deleteConnections");
    }
    try {
      await deleteConnections(ids);
    } catch (err) {
      console.error("Failed to delete databases:", err);
      throw err;
    }
  }
);

ipcMain.handle(
  "connections:updateConnection",
  async (event, id: number, values: Partial<ConnectionType>) => {
    if (!isAuthorized(event)) {
      throw new Error("Unauthorized access to updateConnection");
    }
    try {
      const database = await updateConnection(id, values);
      return database;
    } catch (err) {
      console.error("Failed to update database:", err);
      throw err;
    }
  }
);

ipcMain.handle(
  "connections:createConnection",
  async (event, values: Omit<ConnectionType, "id">) => {
    if (!isAuthorized(event)) {
      throw new Error("Unauthorized access to createConnection");
    }
    try {
      const database = await createConnection(values);
      return database;
    } catch (err) {
      console.error("Failed to create database:", err);
      throw err;
    }
  }
);

ipcMain.handle(
  "connections:testConnection",
  async (event, db: Omit<ConnectionType, "id">) => {
    if (!isAuthorized(event)) {
      throw new Error("Unauthorized access to testConnection");
    }
    try {
      const success = await testConnection(db);
      return success;
    } catch (err) {
      console.error("Failed to test connection:", err);
      throw err;
    }
  }
);

ipcMain.handle("connections:connect", async (event, db: ConnectionType) => {
  if (!isAuthorized(event)) {
    throw new Error("Unauthorized access to connect");
  }
  try {
    await connect(db);
  } catch (err) {
    console.error("Failed to connect to database:", err);
    throw err;
  }
});

ipcMain.handle("connections:disconnect", async (event, db: ConnectionType) => {
  if (!isAuthorized(event)) {
    throw new Error("Unauthorized access to disconnect");
  }
  try {
    await disconnect(db);
  } catch (err) {
    console.error("Failed to disconnect from database:", err);
    throw err;
  }
});

ipcMain.handle("connections:listActiveConnections", async (event) => {
  if (!isAuthorized(event)) {
    throw new Error("Unauthorized access to listActiveConnections");
  }
  try {
    const active = listActive();
    return active;
  } catch (err) {
    console.error("Failed to list active connections:", err);
    throw err;
  }
});

ipcMain.handle(
  "connections:listRemoteDatabases",
  async (event, db: ConnectionType) => {
    if (!isAuthorized(event)) {
      throw new Error("Unauthorized access to listRemoteDatabases");
    }
    try {
      const remotes = await listRemoteDatabases(db);
      return remotes;
    } catch (error) {
      console.error("Failed to list remote databases", error);
      throw error;
    }
  }
);

ipcMain.handle(
  "connections:listSchemas",
  async (event, db: ConnectionType, targetDb?: string) => {
    if (!isAuthorized(event)) {
      throw new Error("Unauthorized access to listSchemas");
    }
    try {
      const schemas = await listSchemas(db, targetDb);
      return schemas;
    } catch (error) {
      console.error("Failed to list schemas", error);
      throw error;
    }
  }
);

ipcMain.handle(
  "connections:listSchemaTables",
  async (
    event,
    db: ConnectionType,
    targetSchema: string,
    targetDb?: string
  ) => {
    if (!isAuthorized(event)) {
      throw new Error("Unauthorized access to listSchemaTables");
    }
    try {
      const tables = await listSchemaTables(db, targetSchema, targetDb);
      return tables;
    } catch (error) {
      console.error("Failed to list tables for ", targetSchema, error);
      throw error;
    }
  }
);

ipcMain.handle(
  "connections:query",
  async (event, db: ConnectionType, sql: string, params?: any[]) => {
    if (!isAuthorized(event)) {
      throw new Error("Unauthorized access to query");
    }
    try {
      const result = await query(db, sql, params);
      return result;
    } catch (error) {
      console.error("Failed to run query ", sql, error);
      throw error;
    }
  }
);

ipcMain.handle(
  "connections:getFullSchema",
  async (event, db: ConnectionType, targetDb?: string) => {
    if (!isAuthorized(event)) {
      throw new Error("Unauthorized access to getFullSchema");
    }
    try {
      const schema = await getFullSchema(db, targetDb);
      return schema;
    } catch (error) {
      console.error("Failed to get full schema");
      throw error;
    }
  }
);

ipcMain.handle(
  "connections:getConnectionSchema",
  async (event, connection: number) => {
    if (!isAuthorized(event)) {
      throw new Error("Unauthorized access to getConnectionSchema");
    }
    try {
      const schema = await getConnectionSchema(connection);
      return schema;
    } catch (error) {
      console.error("Failed to get full schema");
      throw error;
    }
  }
);

