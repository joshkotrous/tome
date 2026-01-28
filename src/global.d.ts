import { DatabaseSchema, JsonQueryResult, TableDef } from "core/connection";
import {
  Conversation,
  TomeMessage,
  ProxyRequestOptions,
  ProxyStreamResponse,
  Query,
  Settings,
  StreamData,
  Connection,
  IndexJob,
  ConnectionSchema,
  Column,
  Table,
  UpdateInfo,
  DownloadProgress,
} from "./types";

export {};

interface ConnectionsApi {
  listConnections: () => Promise<Connection[]>;
  getConnection: (id: number) => Promise<Connection>;
  deleteConnections: (ids: number[]) => Promise<void>;
  updateConnection: (
    id: number,
    values: Partial<Connection>
  ) => Promise<Connection>;
  createConnection: (values: Omit<Connection, "id">) => Promise<Connection>;
  testConnection: (
    db: Omit<Connection, "id">
  ) => Promise<{ success: boolean; error: string }>;
  connect: (db: Connection) => Promise<void>;
  disconnect: (db: Connection) => Promise<void>;
  listRemoteDatabases: (db: Connection) => Promise<string[]>;
  listSchemas: (db: Connection, targetDb?: string) => Promise<string[]>;
  listSchemaTables: (
    db: Connection,
    targetSchema: string,
    targetDb?: string
  ) => Promise<TableDef[]>;
  query: (
    db: Connection,
    sql: string,
    params?: any[]
  ) => Promise<JsonQueryResult>;
  getFullSchema: (db: Connection, targetDb?: string) => Promise<DatabaseSchema>;
  getConnectionSchema: (connection: number) => Promise<ConnectionSchema>;
  getSampleDatabasePath: () => Promise<string>;
}

interface SettingsApi {
  getSettings: () => Promise<Settings>;
  updateSettings: (settings: Partial<Settings>) => Promise<Settings>;
}

interface MessagesApi {
  createMessage: (
    values: Omit<TomeMessage, "id" | "createdAt">
  ) => Promise<TomeMessage>;
  listMessages: (
    conversation?: number,
    query?: number
  ) => Promise<TomeMessage[]>;
  updateMessage: (
    id: string,
    values: Partial<TomeMessage>
  ) => Promie<TomeMessage>;
}

interface ConversationsApi {
  createConversation: (initialMessage: string) => Promise<Conversation>;
  listConversations: () => Promise<Conversation[]>;
  deleteConversation: (conversation: number) => Promise<void>;
  getConversation: (id: number) => Promise<Conversation>;
}

interface QueriesApi {
  listQueries: () => Promise<Query[]>;
  getQuery: (id: number) => Promise<Query>;
  updateQuery: (id: number, values: Partial<Query>) => Promise<Query>;
  deleteQuery: (id: number) => Promise<void>;
  createQuery: (values: Omit<Query, "id">) => Promise<Query>;
}

interface ProxyApi {
  fetchStream: (
    url: string,
    options?: Record<string, unknown>
  ) => Promise<ProxyStreamResponse>;
  cancelStream?: (streamId: string) => Promise<{ success: boolean; error?: string }>;
}

interface JobsApi {
  listIndexJobs: (
    connection: number,
    status?: IndexJob["status"]
  ) => Promise<IndexJob[]>;
  updateSemanticIndex: (connection: Connection) => Promise<Connection>;
}

interface ColumnsApi {
  updateColumn: (id: number, values: Partial<Column>) => Promise<Column>;
}

interface TablesApi {
  updateTable: (id: number, values: Partial<Table>) => Promise<Table>;
}

interface SchemasApi {
  updateSchema: (id: number, values: Partial<Schema>) => Promise<Schema>;
}

interface UpdatesApi {
  checkForUpdates: () => Promise<UpdateInfo>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  getCurrentVersion: () => Promise<string>;
  getUpdateAvailable: () => Promise<boolean>;
  onUpdateStatus: (callback: (data: UpdateInfo) => void) => () => void;
  onDownloadProgress: (callback: (data: DownloadProgress) => void) => () => void;
}

declare global {
  interface Window {
    connections: ConnectionsApi;
    settings: SettingsApi;
    messages: MessagesApi;
    conversations: ConversationsApi;
    queries: QueriesApi;
    proxy: ProxyApi;
    jobs: JobsApi;
    columns: ColumnsApi;
    tables: TablesApi;
    schemas: SchemasApi;
    updates: UpdatesApi;
  }
}
