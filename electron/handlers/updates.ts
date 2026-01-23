import { ipcMain } from "electron";
import {
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getCurrentVersion,
  getUpdateAvailable,
} from "../../core/autoUpdater";

ipcMain.handle("updates:checkForUpdates", async () => {
  try {
    const updateInfo = await checkForUpdates();
    return updateInfo;
  } catch (err) {
    console.error("Failed to check for updates:", err);
    throw err;
  }
});

ipcMain.handle("updates:downloadUpdate", async () => {
  try {
    await downloadUpdate();
  } catch (err) {
    console.error("Failed to download update:", err);
    throw err;
  }
});

ipcMain.handle("updates:installUpdate", async () => {
  try {
    installUpdate();
  } catch (err) {
    console.error("Failed to install update:", err);
    throw err;
  }
});

ipcMain.handle("updates:getCurrentVersion", () => {
  return getCurrentVersion();
});

ipcMain.handle("updates:getUpdateAvailable", () => {
  return getUpdateAvailable();
});
