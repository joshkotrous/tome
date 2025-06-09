import { ConnectionConfig as MYSQLConnection } from "mysql";
import { ConnectionConfig as PGConnection } from "pg";
import { z } from "zod";

export const DatabaseEngineObject = z.enum(["Postgres", "MySQL", "SQLite"]);

export type DatabaseEngine = z.infer<typeof DatabaseEngineObject>;

export type Connection = PGConnection | MYSQLConnection;

export type Database = {
  id: number;
  name: string;
  engine: DatabaseEngine;
  description: string | null;
  connection: Connection;
  createdAt: Date;
};

export type AIProvider = "Open AI" | "Anthropic";

export const SettingsObject = z.object({
  aiFeatures: z.object({
    enabled: z.boolean(),
    provider: z.enum(["Open AI", "Anthropic"]).optional(),
    apiKey: z.string().optional(),
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
  role: "assistant" | "user";
  content: string;
  conversation: number;
  createdAt: Date;
};
