import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import { app } from "electron";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const raw = new Database(path.join(app.getPath("userData"), "tome.sqlite"));
export const db = drizzle(raw, { schema });
