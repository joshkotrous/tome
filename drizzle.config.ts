import { defineConfig } from "drizzle-kit";
import "dotenv/config";
import os from "node:os";
import path from "path";

export default defineConfig({
  schema: ["./db/schema.ts"],
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${path.join(userDataDir("tome"), "tome.sqlite")}`,
  },
  strict: true,
});

function userDataDir(appName: string): string {
  const home = os.homedir();

  switch (process.platform) {
    case "darwin": // macOS
      return path.join(home, "Library", "Application Support", appName);

    case "win32": // Windows
      return path.join(
        process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
        appName
      );

    default: // Linux / *nix
      return path.join(
        process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"),
        appName
      );
  }
}
