import { DatabaseSchema, JsonQueryResult, TableDef } from "core/database";
import { Conversation, ConversationMessage, Database, Settings } from "./types";

export {};

interface DbApi {
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

interface SettingsApi {
  getSettings: () => Promise<Settings>;
  updateSettings: (settings: Partial<Settings>) => Promise<Settings>;
}

interface MessagesApi {
  createMessage: (
    values: Omit<ConversationMessage, "id" | "createdAt">
  ) => Promise<ConversationMessage>;
  listMessages: (conversation: number) => Promise<ConversationMessage[]>;
}

interface ConversationsApi {
  createConversation: (initialMessage: string) => Promise<Conversation>;
  listConversations: () => Promise<Conversation[]>;
  deleteConversation: (conversation: number) => Promise<void>;
}

declare global {
  interface Window {
    db: DbApi;
    settings: SettingsApi;
    messages: MessagesApi;
    conversations: ConversationsApi;
  }
}
