import {
  connect,
  createDatabase,
  deleteDatabases,
  disconnect,
  getDatabase,
  getFullSchema,
  listActive,
  listDatabases,
  listRemoteDatabases,
  listSchemas,
  listSchemaTables,
  query,
  testConnection,
  updateDatabase,
} from "../../core/database";
import { Database as DatabaseType } from "../../src/types";
import { ipcMain } from "electron";

ipcMain.handle("db:listDatabases", async () => {
  try {
    const databases = await listDatabases();
    return databases;
  } catch (err) {
    console.error("Failed to list databases:", err);
    throw err;
  }
});

ipcMain.handle("db:getDatabase", async (_event, id: number) => {
  try {
    const database = await getDatabase(id);
    return database;
  } catch (err) {
    console.error("Failed to get database:", err);
    throw err;
  }
});
ipcMain.handle("db:deleteDatabases", async (_event, ids: number[]) => {
  try {
    await deleteDatabases(ids);
  } catch (err) {
    console.error("Failed to delete databases:", err);
    throw err;
  }
});
ipcMain.handle(
  "db:updateDatabase",
  async (_event, id: number, values: Partial<DatabaseType>) => {
    try {
      const database = await updateDatabase(id, values);
      return database;
    } catch (err) {
      console.error("Failed to update database:", err);
      throw err;
    }
  }
);

ipcMain.handle(
  "db:createDatabase",
  async (_event, values: Omit<DatabaseType, "id">) => {
    try {
      const database = await createDatabase(values);
      return database;
    } catch (err) {
      console.error("Failed to create database:", err);
      throw err;
    }
  }
);

ipcMain.handle(
  "db:testConnection",
  async (_event, db: Omit<DatabaseType, "id">) => {
    try {
      const success = await testConnection(db);
      return success;
    } catch (err) {
      console.error("Failed to test connection:", err);
      throw err;
    }
  }
);

ipcMain.handle("db:connect", async (_event, db: DatabaseType) => {
  try {
    await connect(db);
  } catch (err) {
    console.error("Failed to connect to database:", err);
    throw err;
  }
});

ipcMain.handle("db:disconnect", async (_event, db: DatabaseType) => {
  try {
    await disconnect(db);
  } catch (err) {
    console.error("Failed to disconnect from database:", err);
    throw err;
  }
});

ipcMain.handle("db:listActiveConnections", async () => {
  try {
    const active = listActive();
    return active;
  } catch (err) {
    console.error("Failed to list active connections:", err);
    throw err;
  }
});

ipcMain.handle("db:listRemoteDatabases", async (_event, db: DatabaseType) => {
  try {
    const remotes = await listRemoteDatabases(db);
    return remotes;
  } catch (error) {
    console.error("Failed to list remote databases", error);
    throw error;
  }
});

ipcMain.handle(
  "db:listSchemas",
  async (_event, db: DatabaseType, targetDb?: string) => {
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
  "db:listSchemaTables",
  async (_event, db: DatabaseType, targetSchema: string, targetDb?: string) => {
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
  "db:query",
  async (_event, db: DatabaseType, sql: string, params?: any[]) => {
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
  "db:getFullSchema",
  async (_event, db: DatabaseType, targetDb?: string) => {
    try {
      const schema = await getFullSchema(db, targetDb);
      return schema;
    } catch (error) {
      console.error("Failed to get full schema");
      throw error;
    }
  }
);
