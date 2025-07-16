import path from "node:path";
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
import { app, ipcMain } from "electron";

ipcMain.handle("connections:listConnections", async () => {
  try {
    const databases = await listConnections();
    return databases;
  } catch (err) {
    console.error("Failed to list databases:", err);
    throw err;
  }
});

ipcMain.handle("connections:getConnection", async (_event, id: number) => {
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
  async (_event, ids: number[]) => {
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
  async (_event, id: number, values: Partial<ConnectionType>) => {
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
  async (_event, values: Omit<ConnectionType, "id">) => {
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
  async (_event, db: Omit<ConnectionType, "id">) => {
    try {
      const success = await testConnection(db);
      return success;
    } catch (err) {
      console.error("Failed to test connection:", err);
      throw err;
    }
  }
);

ipcMain.handle("connections:connect", async (_event, db: ConnectionType) => {
  try {
    await connect(db);
  } catch (err) {
    console.error("Failed to connect to database:", err);
    throw err;
  }
});

ipcMain.handle("connections:disconnect", async (_event, db: ConnectionType) => {
  try {
    await disconnect(db);
  } catch (err) {
    console.error("Failed to disconnect from database:", err);
    throw err;
  }
});

ipcMain.handle("connections:listActiveConnections", async () => {
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
  async (_event, db: ConnectionType) => {
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
  async (_event, db: ConnectionType, targetDb?: string) => {
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
    _event,
    db: ConnectionType,
    targetSchema: string,
    targetDb?: string
  ) => {
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
  async (_event, db: ConnectionType, sql: string, params?: any[]) => {
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
  async (_event, db: ConnectionType, targetDb?: string) => {
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
  async (_event, connection: number) => {
    try {
      const schema = await getConnectionSchema(connection);
      return schema;
    } catch (error) {
      console.error("Failed to get full schema");
      throw error;
    }
  }
);

ipcMain.handle("connections:getSampleDatabasePath", async () => {
  try {
    // Get the app path and construct the sample database path
    const appPath = app.getAppPath();
    const sampleDbPath = path.join(appPath, "db", "samples", "sample.db");

    return sampleDbPath;
  } catch (error) {
    console.error("Failed to get sample database path:", error);
    throw error;
  }
});
