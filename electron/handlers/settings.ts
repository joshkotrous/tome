import { Settings } from "@/types";
import { getSettings, updateSettings } from "../../core/settings";
import { ipcMain } from "electron";

ipcMain.handle("settings:getSettings", async () => {
  try {
    const settings = await getSettings();
    return settings;
  } catch (err) {
    console.error("Failed to get settings:", err);
    throw err;
  }
});

ipcMain.handle(
  "settings:updateSettings",
  async (_event, values: Partial<Settings>) => {
    try {
      console.log("Updating settings...");
      const settings = await updateSettings(values);
      return settings;
    } catch (err) {
      console.error("Failed to update settings:", err);
      throw err;
    }
  }
);
