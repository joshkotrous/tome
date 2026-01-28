import { UIMessage } from "ai";
import { ConnectionConfig as MYSQLConnection } from "mysql";
import { ConnectionConfig as PGConnection } from "pg";
import { z } from "zod";

export const DatabaseEngineObject = z.enum(["Postgres", "MySQL", "SQLite"]);

export type DatabaseEngine = z.infer<typeof DatabaseEngineObject>;

export type SQLiteConnection = {
  database: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  ssl?: boolean;
};

export type ConnectionConfig = PGConnection | MYSQLConnection | SQLiteConnection;

export type ConnectionSettings = {
  autoUpdateSemanticIndex: boolean;
};

export type Connection = {
  id: number;
  name: string;
  engine: DatabaseEngine;
  description: string | null;
  connection: ConnectionConfig;
  createdAt: Date;
  settings: ConnectionSettings;
};

export type AIProvider = "Open AI" | "Anthropic" | "Local";

export const LocalModelObject = z.object({
  url: z.string(),
  models: z.array(z.string()),
});

export type LocalModel = z.infer<typeof LocalModelObject>;

export const SettingsObject = z.object({
  setupComplete: z.boolean(),
  aiFeatures: z.object({
    enabled: z.boolean(),
    providers: z.object({
      anthropic: z.object({ enabled: z.boolean(), apiKey: z.string() }),
      openai: z.object({ enabled: z.boolean(), apiKey: z.string() }),
    }),
    localModel: LocalModelObject.optional(),
  }),
  autoUpdates: z.boolean().optional().default(true),
});

export type Settings = z.infer<typeof SettingsObject>;

export type UpdateStatus =
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export type UpdateInfo = {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  releaseName?: string;
  releaseDate?: string;
  error?: string;
};

export type DownloadProgress = {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
};

export type Conversation = {
  id: number;
  name: string;
  createdAt: Date;
};

export type MessageMetadata = {
  queryResults?: {
    query: string;
    records: Record<string, any>[];
    totalCount: number;
    columns?: string[];
  };
  visualization?: {
    chartType: string;
    xAxis: string;
    yAxis: string | string[];
    title?: string;
  };
};

export type TomeMessage = UIMessage & {
  conversation: number | null;
  query: number | null;
  metadata?: MessageMetadata;
};

export type Query = {
  id: number;
  connection: number;
  query: string;
  createdAt: Date;
  title: string;
};

export type TableSchema = {
  table: Table;
  columns: Column[];
};

export type SchemaDef = {
  schema: Schema;
  tables: TableSchema[];
};

export type DatabaseSchema = {
  database: Database;
  schemas: SchemaDef[];
};

export type ConnectionSchema = {
  connection: Connection;
  databases: DatabaseSchema[];
};

export type Schema = {
  id: number;
  database: number;
  name: string;
  description: string | null;
};

export type Database = {
  id: number;
  connection: number;
  name: string;
  description: string | null;
};

export type Table = {
  id: number;
  schema: number;
  name: string;
  description: string | null;
};

export type Column = {
  id: number;
  table: number;
  name: string;
  description: string | null;
  type: string;
};

export interface ProxyResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: any;
  error?: string;
}

export interface ProxyStreamResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  streamId?: string;
  error?: string;
}

export interface StreamData {
  chunk?: string;
  done: boolean;
  error?: string;
}

// Request options interface
export interface ProxyRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export type IndexJob = {
  id: number;
  connection: number;
  itemsToProcess: number | null;
  itemsProcessed: number | null;
  createdAt: Date;
  completedAt: Date | null;
  status: "done" | "processing" | "error";
  error: string | null;
};
