import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { Settings, SettingsObject } from "../../src/types";
import { decrypt, encrypt } from "../encrypt";

const settingsPath = path.join(app.getPath("userData"), "settings.json");

const defaultSettings: Settings = {
  setupComplete: false,
  aiFeatures: {
    enabled: false,
    providers: {
      openai: {
        enabled: false,
        apiKey: "",
      },
      anthropic: {
        enabled: false,
        apiKey: "",
      },
    },
    localModel: {
      url: "",
      models: [],
    },
  },
  autoUpdates: true,
};

export async function initializeSettings(): Promise<{
  path: string;
  settings: Settings;
}> {
  try {
    await fs.access(settingsPath);
    const settings = await fs.readFile(settingsPath, "utf-8");
    try {
      const parsedSettings = SettingsObject.parse(JSON.parse(settings));
      return {
        path: settingsPath,
        settings: parsedSettings,
      };
    } catch (error) {
      console.log(error);
      await fs.rm(settingsPath);
      await fs.writeFile(
        settingsPath,
        JSON.stringify(defaultSettings, null, 2)
      );
      return { path: settingsPath, settings: defaultSettings };
    }
  } catch (error) {
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    console.log("Initializing settings...");
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
    console.log("Successfully initialized settings...");
    return { path: settingsPath, settings: defaultSettings };
  }
}

export async function getSettings(): Promise<Settings> {
  try {
    const settingsContent = await fs.readFile(settingsPath, "utf-8");
    const parsed = JSON.parse(settingsContent);
    let settings = SettingsObject.parse(parsed);

    settings = await decryptApiKeys(settings);

    return settings;
  } catch (error) {
    console.error("Error reading settings:", error);
    // If we can't read settings, reinitialize them
    const { settings } = await initializeSettings();
    return settings;
  }
}

async function decryptApiKeys(settings: Settings): Promise<Settings> {
  const providers = settings.aiFeatures.providers;
  const decryptedProviders = { ...providers };

  // Decrypt Anthropic API key
  if (providers.anthropic.apiKey) {
    try {
      const decryptedKey = await decrypt(providers.anthropic.apiKey);
      decryptedProviders.anthropic = {
        ...providers.anthropic,
        apiKey: decryptedKey,
      };
    } catch (error) {
      console.warn("Failed to decrypt Anthropic API key:", error);
      // Keep the original encrypted value or set to empty string
      decryptedProviders.anthropic = {
        ...providers.anthropic,
        apiKey: "",
      };
    }
  }

  // Decrypt OpenAI API key
  if (providers.openai.apiKey) {
    try {
      const decryptedKey = await decrypt(providers.openai.apiKey);
      decryptedProviders.openai = {
        ...providers.openai,
        apiKey: decryptedKey,
      };
    } catch (error) {
      console.warn("Failed to decrypt OpenAI API key:", error);
      // Keep the original encrypted value or set to empty string
      decryptedProviders.openai = {
        ...providers.openai,
        apiKey: "",
      };
    }
  }

  return {
    ...settings,
    aiFeatures: {
      ...settings.aiFeatures,
      providers: decryptedProviders,
    },
  };
}

export async function updateSettings(
  values: Partial<Settings>
): Promise<Settings> {
  try {
    const initialSettings = await getSettings();
    const settings = {
      ...initialSettings,
      ...values,
    };

    // Encrypt API keys before saving
    const encryptedSettings = await encryptApiKeys(settings);

    await fs.writeFile(
      settingsPath,
      JSON.stringify(encryptedSettings, null, 2)
    );

    return settings; // Return unencrypted settings
  } catch (error) {
    console.error("Error updating settings:", error);
    throw error;
  }
}

async function encryptApiKeys(settings: Settings): Promise<Settings> {
  const providers = settings.aiFeatures.providers;
  const encryptedProviders = { ...providers };

  // Encrypt Anthropic API key
  if (providers.anthropic.apiKey) {
    try {
      const encryptedKey = await encrypt(providers.anthropic.apiKey);
      encryptedProviders.anthropic = {
        ...providers.anthropic,
        apiKey: encryptedKey,
      };
    } catch (error) {
      console.error("Failed to encrypt Anthropic API key:", error);
      throw new Error("Failed to encrypt Anthropic API key");
    }
  }

  // Encrypt OpenAI API key
  if (providers.openai.apiKey) {
    try {
      const encryptedKey = await encrypt(providers.openai.apiKey);
      encryptedProviders.openai = {
        ...providers.openai,
        apiKey: encryptedKey,
      };
    } catch (error) {
      console.error("Failed to encrypt OpenAI API key:", error);
      throw new Error("Failed to encrypt OpenAI API key");
    }
  }

  return {
    ...settings,
    aiFeatures: {
      ...settings.aiFeatures,
      providers: encryptedProviders,
    },
  };
}
