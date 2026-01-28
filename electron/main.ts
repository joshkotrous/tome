import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import { createRequire } from "module";
import { initializeSettings } from "../core/settings";
import log from "electron-log/main";
import fs from "fs/promises";

console.log = (...args) => log.info(...args);
console.error = (...args) => log.error(...args);
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(app.getPath("userData"), "tome.sqlite");

console.log("DB AT ", dbPath);

async function initDb() {
  console.log("Initializing database...");
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const raw = new Database(dbPath);
  const db = drizzle(raw, { schema });
  const migrationsPath = app.isPackaged
    ? path.join(process.resourcesPath, "db", "migrations")
    : path.join(__dirname, "../db/migrations");

  console.log("Running migrations from ", migrationsPath);
  try {
    migrate(db, {
      migrationsFolder: migrationsPath,
    });
  } catch (error) {
    console.error("Error migration database, resetting", error);
    await fs.rm(dbPath);
    const db = drizzle(raw, { schema });
    migrate(db, {
      migrationsFolder: migrationsPath,
    });
    console.log("Successfully reset and migrated db");
  }

  console.log("Database initialized successfully");
}

process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");

const RENDERER_DIST = app.isPackaged
  ? path.join(app.getAppPath(), "dist")
  : path.join(process.env.APP_ROOT!, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

const indexPath = path.join(RENDERER_DIST, "index.html");

let win: BrowserWindow | null;

async function createWindow() {
  await initDb();
  await initializeSettings();
  win = new BrowserWindow({
    // --- visuals ----------------------------------------------------------
    width: 1280,
    height: 800,
    titleBarStyle: "hiddenInset", // must be hidden/hiddenInset to enable overlay
    titleBarOverlay: {
      color: "#09090b", // your dark zinc
      height: 28, // optional, defaults to native height
    },
    backgroundColor: "#09090b", // fills the window before renderer loads
    // --- assets -----------------------------------------------------------
    icon: path.join(process.env.VITE_PUBLIC!, "tome.svg"),

    // --- security + preload ----------------------------------------------
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(indexPath);
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

import "./handlers/connections";
import "./handlers/conversations";
import "./handlers/messages";
import "./handlers/queries";
import "./handlers/settings";
import "./handlers/jobs";
import "./handlers/columns";
import "./handlers/tables";
import "./handlers/schemas";
import "./handlers/proxy";
import "./handlers/updates";