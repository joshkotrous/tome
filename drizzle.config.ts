import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: ["./db/schema.ts"],
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:/Users/josh-pensar/Library/Application Support/wayfarer/myapp.sqlite`,
  },
  strict: true,
});
