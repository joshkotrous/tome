import { Connection, DatabaseEngine } from "../src/types";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const databases = sqliteTable("connections", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  name: text().notNull(),
  description: text(),
  engine: text("engine", { enum: ["Postgres", "MySQL", "SQLite"] })
    .$type<DatabaseEngine>()
    .notNull(),
  connection: text("connection", { mode: "json" })
    .$type<Connection>()
    .notNull(),
  createdAt: integer({ mode: "timestamp" }).default(new Date()).notNull(),
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
    .references(() => databases.id),
  query: text().notNull(),
  createdAt: integer({ mode: "timestamp" }).notNull(),
  title: text().notNull(),
});
