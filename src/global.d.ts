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
