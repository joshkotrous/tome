import { Connection, DatabaseEngine } from "../src/types";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const databases = sqliteTable("databases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  description: text(),
  engine: text("engine", { enum: ["Postgres", "MySQL", "SQLite"] })
    .$type<DatabaseEngine>()
    .notNull(),
  connection: text("connection", { mode: "json" })
    .$type<Connection>()
    .notNull(),
});
