import { z } from "zod";

export const DatabaseEngineObject = z.enum(["Postgres", "MySQL", "SQLite"]);

export type DatabaseEngine = z.infer<typeof DatabaseEngineObject>;

export type Connection = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

export type Database = {
  id: number;
  name: string;
  engine: DatabaseEngine;
  description: string | null;
  connection: Connection;
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
