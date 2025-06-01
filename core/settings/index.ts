import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { Settings, SettingsObject } from "../../src/types";
import { decrypt, encrypt } from "../encrypt";

const settingsPath = path.join(app.getPath("userData"), "settings.json");

const defaultSettings: Settings = {
  aiFeatures: {
    enabled: false,
  },
};

export async function initializeSettings(): Promise<string> {
  try {
    await fs.access(settingsPath);
    console.log("Settings already initialized.");
  } catch (error) {
    console.log("Initializing settings...");
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
    console.log("Successfully initialized settings...");
  }
  return settingsPath;
}

export async function getSettings(): Promise<Settings> {
  const settingsContent = await fs.readFile(settingsPath, "utf-8");
  const parsed = JSON.parse(settingsContent);
  let settings = SettingsObject.parse(parsed);
  if (settings.aiFeatures.apiKey) {
    const decryptedValue = await decrypt(settings.aiFeatures.apiKey);
    settings = {
      aiFeatures: {
        ...settings.aiFeatures,
        apiKey: decryptedValue,
      },
    };
  }
  return settings;
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  if (settings.aiFeatures.apiKey) {
    const encryptedKey = await encrypt(settings.aiFeatures.apiKey);
    settings = {
      aiFeatures: {
        ...settings.aiFeatures,
        apiKey: encryptedKey,
      },
    };
  }
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

  return settings;
}
