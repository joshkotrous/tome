import { autoUpdater, UpdateInfo as ElectronUpdateInfo } from "electron-updater";
import { BrowserWindow } from "electron";
import log from "electron-log";

// Configure logging for auto-updater
autoUpdater.logger = log;

// Disable auto-download by default - we'll control this based on settings
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

export type UpdateStatus =
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateInfo {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  releaseName?: string;
  releaseDate?: string;
  error?: string;
}

export interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

let mainWindow: BrowserWindow | null = null;
let updateAvailable = false;
let downloadedUpdateInfo: ElectronUpdateInfo | null = null;

export function setMainWindow(win: BrowserWindow) {
  mainWindow = win;
}

function sendStatusToWindow(status: UpdateStatus, data?: Partial<UpdateInfo>) {
  if (mainWindow) {
    mainWindow.webContents.send("update-status", { status, ...data });
  }
}

function sendProgressToWindow(progress: DownloadProgress) {
  if (mainWindow) {
    mainWindow.webContents.send("update-download-progress", progress);
  }
}

// Set up event listeners
autoUpdater.on("checking-for-update", () => {
  log.info("Checking for update...");
  sendStatusToWindow("checking");
});

autoUpdater.on("update-available", (info: ElectronUpdateInfo) => {
  log.info("Update available:", info.version);
  updateAvailable = true;
  sendStatusToWindow("available", {
    latestVersion: info.version,
    releaseNotes:
      typeof info.releaseNotes === "string"
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => n.note).join("\n")
          : undefined,
    releaseName: info.releaseName || undefined,
    releaseDate: info.releaseDate,
  });
});

autoUpdater.on("update-not-available", (info: ElectronUpdateInfo) => {
  log.info("Update not available. Current version is latest:", info.version);
  updateAvailable = false;
  sendStatusToWindow("not-available", {
    currentVersion: info.version,
    latestVersion: info.version,
  });
});

autoUpdater.on("error", (err: Error) => {
  log.error("Error in auto-updater:", err);
  sendStatusToWindow("error", {
    error: err.message,
  });
});

autoUpdater.on("download-progress", (progress) => {
  log.info(`Download progress: ${progress.percent.toFixed(1)}%`);
  sendProgressToWindow({
    bytesPerSecond: progress.bytesPerSecond,
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
  });
});

autoUpdater.on("update-downloaded", (info: ElectronUpdateInfo) => {
  log.info("Update downloaded:", info.version);
  downloadedUpdateInfo = info;
  sendStatusToWindow("downloaded", {
    latestVersion: info.version,
    releaseNotes:
      typeof info.releaseNotes === "string"
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => n.note).join("\n")
          : undefined,
    releaseName: info.releaseName || undefined,
    releaseDate: info.releaseDate,
  });
});

export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    const result = await autoUpdater.checkForUpdates();

    if (!result) {
      return {
        status: "not-available",
        currentVersion: autoUpdater.currentVersion.version,
      };
    }

    const info = result.updateInfo;
    const isAvailable = autoUpdater.currentVersion.compare(info.version) < 0;

    return {
      status: isAvailable ? "available" : "not-available",
      currentVersion: autoUpdater.currentVersion.version,
      latestVersion: info.version,
      releaseNotes:
        typeof info.releaseNotes === "string"
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map((n) => n.note).join("\n")
            : undefined,
      releaseName: info.releaseName || undefined,
      releaseDate: info.releaseDate,
    };
  } catch (error) {
    log.error("Failed to check for updates:", error);
    return {
      status: "error",
      currentVersion: autoUpdater.currentVersion.version,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function downloadUpdate(): Promise<void> {
  if (!updateAvailable) {
    throw new Error("No update available to download");
  }
  await autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  if (!downloadedUpdateInfo) {
    throw new Error("No update downloaded to install");
  }
  // This will quit the app and install the update
  autoUpdater.quitAndInstall(false, true);
}

export function getUpdateAvailable(): boolean {
  return updateAvailable;
}

export function getDownloadedUpdateInfo(): ElectronUpdateInfo | null {
  return downloadedUpdateInfo;
}

export function getCurrentVersion(): string {
  return autoUpdater.currentVersion.version;
}
