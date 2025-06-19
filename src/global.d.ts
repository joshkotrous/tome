import { DatabaseSchema, JsonQueryResult, TableDef } from "core/connection";
import {
  Conversation,
  ConversationMessage,
  ProxyRequestOptions,
  ProxyStreamResponse,
  Query,
  Settings,
  StreamData,
  Connection,
  IndexJob,
  ConnectionSchema,
} from "./types";

export {};

interface ConnectionsApi {
  listConnections: () => Promise<Connection[]>;
  getConnection: (id: number) => Promise<Connection>;
  deleteConnections: (ids: number[]) => Promise<void>;
  updateConnection: (id: number, values: Connection) => Promise<Connection>;
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
}

interface SettingsApi {
  getSettings: () => Promise<Settings>;
  updateSettings: (settings: Partial<Settings>) => Promise<Settings>;
}

interface MessagesApi {
  createMessage: (
    values: Omit<ConversationMessage, "id" | "createdAt">
  ) => Promise<ConversationMessage>;
  listMessages: (
    conversation?: number,
    query?: number
  ) => Promise<ConversationMessage[]>;
}

interface ConversationsApi {
  createConversation: (initialMessage: string) => Promise<Conversation>;
  listConversations: () => Promise<Conversation[]>;
  deleteConversation: (conversation: number) => Promise<void>;
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
    options?: ProxyRequestOptions
  ) => Promise<ProxyStreamResponse>;
  onStreamData: (
    streamId: string,
    callback: (data: StreamData) => void
  ) => () => void;
}

interface JobsApi {
  listIndexJobs: (
    connection: number,
    status?: IndexJob["status"]
  ) => Promise<IndexJob[]>;
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
  }
}
