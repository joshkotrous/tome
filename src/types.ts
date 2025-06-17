import { ConnectionConfig as MYSQLConnection } from "mysql";
import { ConnectionConfig as PGConnection } from "pg";
import { z } from "zod";

export const DatabaseEngineObject = z.enum(["Postgres", "MySQL", "SQLite"]);

export type DatabaseEngine = z.infer<typeof DatabaseEngineObject>;

export type ConnectionConfig = PGConnection | MYSQLConnection;

export type Connection = {
  id: number;
  name: string;
  engine: DatabaseEngine;
  description: string | null;
  connection: ConnectionConfig;
  createdAt: Date;
};

export type AIProvider = "Open AI" | "Anthropic";

export const SettingsObject = z.object({
  setupComplete: z.boolean(),
  aiFeatures: z.object({
    enabled: z.boolean(),
    providers: z.object({
      anthropic: z.object({ enabled: z.boolean(), apiKey: z.string() }),
      openai: z.object({ enabled: z.boolean(), apiKey: z.string() }),
    }),
  }),
});

export type Settings = z.infer<typeof SettingsObject>;

export type Conversation = {
  id: number;
  name: string;
  createdAt: Date;
};

export type ConversationMessage = {
  id: number;
  role: "assistant" | "user" | "tool-call";
  content: string;
  conversation: number | null;
  query: number | null;
  toolCallId: string | null;
  toolCallStatus: "pending" | "error" | "complete" | null;
  createdAt: Date;
};

export type Query = {
  id: number;
  connection: number;
  query: string;
  createdAt: Date;
  title: string;
};

export type Database = {
  id: number;
  connection: number;
  name: string;
  description: string | null;
};

export type Column = {
  id: number;
  database: number;
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
