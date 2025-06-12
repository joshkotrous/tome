import { defineConfig } from "drizzle-kit";
import { dbPath } from "./electron/main";
import "dotenv/config";

export default defineConfig({
  schema: ["./db/schema.ts"],
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${dbPath}`,
  },
  strict: true,
});
