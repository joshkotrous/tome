import {
  ConnectionConfig,
  ConnectionSettings,
  DatabaseEngine,
} from "../src/types";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const connections = sqliteTable("connections", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  name: text().notNull(),
  description: text(),
  engine: text("engine", { enum: ["Postgres", "MySQL", "SQLite"] })
    .$type<DatabaseEngine>()
    .notNull(),
  connection: text("connection", { mode: "json" })
    .$type<ConnectionConfig>()
    .notNull(),
  createdAt: integer({ mode: "timestamp" }).default(new Date()).notNull(),
  settings: text("settings", { mode: "json" })
    .$type<ConnectionSettings>()
    .notNull()
    .default({
      autoUpdateSemanticIndex: false,
    }),
});

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  name: text().notNull(),
  createdAt: integer({ mode: "timestamp" }).default(new Date()).notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  role: text("role", { enum: ["assistant", "user", "tool-call"] }).notNull(),
  content: text().notNull(),
  conversation: integer().references(() => conversations.id, {
    onDelete: "cascade",
  }),
  query: integer().references(() => queries.id, { onDelete: "cascade" }),
  toolCallId: text(),
  toolCallStatus: text("toolCallStatus", {
    enum: ["pending", "error", "complete"],
  }),
  createdAt: integer({ mode: "timestamp" }).notNull(),
});

export const queries = sqliteTable("queries", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  connection: integer()
    .notNull()
    .references(() => connections.id, { onDelete: "cascade" }),
  query: text().notNull(),
  createdAt: integer({ mode: "timestamp" }).notNull(),
  title: text().notNull(),
});

export const databases = sqliteTable("databases", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  connection: integer()
    .notNull()
    .references(() => connections.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
});

export const schemas = sqliteTable("schemas", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  database: integer()
    .notNull()
    .references(() => databases.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
});

export const tables = sqliteTable("tables", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  schema: integer()
    .notNull()
    .references(() => schemas.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
});

export const columns = sqliteTable("columns", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  table: integer("table")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  type: text().notNull(),
});

export const indexJobs = sqliteTable("indexJobs", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  connection: integer()
    .notNull()
    .references(() => connections.id, { onDelete: "cascade" }),
  itemsToProcess: integer(),
  itemsProcessed: integer(),
  createdAt: integer({ mode: "timestamp" }).default(new Date()).notNull(),
  completedAt: integer({ mode: "timestamp" }),
  error: text(),
  status: text("status", { enum: ["done", "processing", "error"] })
    .$type<"done" | "processing" | "error">()
    .notNull(),
});
