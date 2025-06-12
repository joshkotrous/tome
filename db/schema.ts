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
  role: text("role", { enum: ["assistant", "user"] }).notNull(),
  content: text().notNull(),
  conversation: integer()
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  createdAt: integer({ mode: "timestamp" }).notNull(),
});
