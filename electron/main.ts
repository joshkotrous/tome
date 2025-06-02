import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import { createRequire } from "module";
import {
  getSettings,
  initializeSettings,
  updateSettings,
} from "../core/settings";
import {
  connect,
  createDatabase,
  deleteDatabases,
  disconnect,
  getDatabase,
  listActive,
  listDatabases,
  listRemoteDatabases,
  listSchemas,
  listSchemaTables,
  testConnection,
  // testConnection,
  updateDatabase,
} from "../core/database";
import { Database as DatabaseType, Settings } from "@/types";
import log from "electron-log/main";
console.log = (...args) => log.info(...args);
console.error = (...args) => log.error(...args);
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const dbPath = path.join(app.getPath("userData"), "myapp.sqlite");

console.log("DB AT ", dbPath);

function initDb() {
  console.log("Initializing database...");
  const raw = new Database(dbPath);
  const db = drizzle(raw, { schema });
  migrate(db, {
    migrationsFolder: "./db/migrations",
  });
  console.log("Database initialized successfully");
  return db;
}

export const db = initDb();
initializeSettings();

process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
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
    icon: path.join(process.env.VITE_PUBLIC!, "electron-vite.svg"),

    // --- security + preload ----------------------------------------------
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: true,
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
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
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

ipcMain.handle("db:listDatabases", async () => {
  try {
    const databases = await listDatabases();
    return databases;
  } catch (err) {
    console.error("Failed to list databases:", err);
    throw err;
  }
});

ipcMain.handle("db:getDatabase", async (_event, id: number) => {
  try {
    const database = await getDatabase(id);
    return database;
  } catch (err) {
    console.error("Failed to get database:", err);
    throw err;
  }
});
ipcMain.handle("db:deleteDatabases", async (_event, ids: number[]) => {
  try {
    await deleteDatabases(ids);
  } catch (err) {
    console.error("Failed to delete databases:", err);
    throw err;
  }
});
ipcMain.handle(
  "db:updateDatabase",
  async (_event, id: number, values: Partial<DatabaseType>) => {
    try {
      const database = await updateDatabase(id, values);
      return database;
    } catch (err) {
      console.error("Failed to update database:", err);
      throw err;
    }
  }
);

ipcMain.handle(
  "db:createDatabase",
  async (_event, values: Omit<DatabaseType, "id">) => {
    try {
      const database = await createDatabase(values);
      return database;
    } catch (err) {
      console.error("Failed to create database:", err);
      throw err;
    }
  }
);

ipcMain.handle("settings:getSettings", async () => {
  try {
    const settings = await getSettings();
    return settings;
  } catch (err) {
    console.error("Failed to get settings:", err);
    throw err;
  }
});

ipcMain.handle("settings:updateSettings", async (_event, values: Settings) => {
  try {
    console.log("Updating settings...");
    const settings = await updateSettings(values);
    return settings;
  } catch (err) {
    console.error("Failed to update settings:", err);
    throw err;
  }
});

ipcMain.handle(
  "db:testConnection",
  async (_event, db: Omit<DatabaseType, "id">) => {
    try {
      const success = await testConnection(db);
      return success;
    } catch (err) {
      console.error("Failed to test connection:", err);
      throw err;
    }
  }
);

ipcMain.handle("db:connect", async (_event, db: DatabaseType) => {
  try {
    await connect(db);
  } catch (err) {
    console.error("Failed to connect to database:", err);
    throw err;
  }
});

ipcMain.handle("db:disconnect", async (_event, db: DatabaseType) => {
  try {
    await disconnect(db);
  } catch (err) {
    console.error("Failed to disconnect from database:", err);
    throw err;
  }
});

ipcMain.handle("db:listActiveConnections", async () => {
  try {
    const active = listActive();
    return active;
  } catch (err) {
    console.error("Failed to list active connections:", err);
    throw err;
  }
});

ipcMain.handle("db:listRemoteDatabases", async (_event, db: DatabaseType) => {
  try {
    const remotes = await listRemoteDatabases(db);
    return remotes;
  } catch (error) {
    console.error("Failed to list remote databases", error);
    throw error;
  }
});

ipcMain.handle(
  "db:listSchemas",
  async (_event, db: DatabaseType, targetDb?: string) => {
    try {
      const schemas = await listSchemas(db, targetDb);
      return schemas;
    } catch (error) {
      console.error("Failed to list schemas", error);
      throw error;
    }
  }
);
ipcMain.handle(
  "db:listSchemaTables",
  async (_event, db: DatabaseType, targetSchema: string, targetDb?: string) => {
    try {
      const tables = await listSchemaTables(db, targetSchema, targetDb);
      return tables;
    } catch (error) {
      console.error("Failed to list tables for ", targetSchema, error);
      throw error;
    }
  }
);
