import { AIProvider, Settings } from "@/types";
import {
  createConversation,
  deleteConversation,
  listConversations,
} from "../../core/conversations";
import { getSettings } from "../../core/settings";
import { ipcMain } from "electron";

ipcMain.handle("conversations:listConversations", async () => {
  try {
    const conversations = await listConversations();
    return conversations;
  } catch (error) {
    console.error("Failed to list conversations");
    throw error;
  }
});

ipcMain.handle(
  "conversations:createConversation",
  async (_event, initialMessage: string) => {
    function getDefaultAISettings(settings: Settings): {
      apiKey: string;
      provider: AIProvider;
    } {
      if (!settings.aiFeatures.enabled) {
        throw new Error("AI Features are disabled");
      }

      if (settings.aiFeatures.providers.openai.enabled) {
        return {
          apiKey: settings.aiFeatures.providers.openai.apiKey,
          provider: "Open AI",
        };
      }

      if (settings.aiFeatures.providers.anthropic.enabled) {
        return {
          apiKey: settings.aiFeatures.providers.anthropic.apiKey,
          provider: "Anthropic",
        };
      }

      throw new Error("No ai provider configured");
    }
    try {
      const settings = await getSettings();
      const { apiKey, provider } = getDefaultAISettings(settings);

      const conversations = await createConversation(initialMessage, {
        apiKey,
        provider,
      });
      return conversations;
    } catch (error) {
      console.error("Failed to create conversation");
      throw error;
    }
  }
);

ipcMain.handle(
  "conversations:deleteConversation",
  async (_event, conversation: number) => {
    try {
      await deleteConversation(conversation);
    } catch (error) {
      console.error("Failed to delete conversation");
      throw error;
    }
  }
);
