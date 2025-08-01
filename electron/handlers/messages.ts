import { TomeMessage } from "@/types";
import {
  createMessage,
  listMessages,
  updateMessage,
} from "../../core/messages";
import { ipcMain } from "electron";

ipcMain.handle(
  "messages:createMessage",
  async (_event, values: Omit<TomeMessage, "id" | "createdAt">) => {
    try {
      const message = await createMessage(values);
      return message;
    } catch (error) {
      console.error("Failed to create message");
      throw error;
    }
  }
);

ipcMain.handle(
  "messages:listMessages",
  async (_event, conversation?: number, query?: number) => {
    try {
      const messages = await listMessages(conversation, query);
      return messages;
    } catch (error) {
      console.error("Failed to list messages");
      throw error;
    }
  }
);

ipcMain.handle(
  "messages:updateMessage",
  async (_event, id: string, values: Partial<TomeMessage>) => {
    try {
      const updated = await updateMessage(id, values);
      return updated;
    } catch (error) {
      console.error("Failed to update message");
      throw error;
    }
  }
);
