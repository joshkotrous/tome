import { DatabaseSchema, JsonQueryResult, TableDef } from "core/database";
import { Database, Settings } from "./types";

export {};

interface DbAPI {
  listDatabases: () => Promise<Database[]>;
  getDatabase: (id: number) => Promise<Database>;
  deleteDatabases: (ids: number[]) => Promise<void>;
  updateDatabase: (id: number, values: Database) => Promise<Database>;
  createDatabase: (values: Omit<Database, "id">) => Promise<Database>;
  testConnection: (
    db: Omit<Database, "id">
  ) => Promise<{ success: boolean; error: string }>;
  connect: (db: Database) => Promise<void>;
  disconnect: (db: Database) => Promise<void>;
  listRemoteDatabases: (db: Database) => Promise<string[]>;
  listSchemas: (db: Database, targetDb?: string) => Promise<string[]>;
  listSchemaTables: (
    db: Database,
    targetSchema: string,
    targetDb?: string
  ) => Promise<TableDef[]>;
  query: (
    db: Database,
    sql: string,
    params?: any[]
  ) => Promise<JsonQueryResult>;
  getFullSchema: (db: Database, targetDb?: string) => Promise<DatabaseSchema>;
}

interface SettingsAPI {
  getSettings: () => Promise<Settings>;
  updateSettings: (settings: Settings) => Promise<Settings>;
}

declare global {
  interface Window {
    db: DbAPI;
    settings: SettingsAPI;
  }
}
