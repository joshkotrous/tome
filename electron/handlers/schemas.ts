import { Schema } from "@/types";
import { updateSchema } from "../../core/schemas";
import { ipcMain } from "electron";

ipcMain.handle(
  "schemas:updateSchema",
  async (_event, id: number, values: Partial<Schema>) => {
    try {
      const updated = await updateSchema(id, values);
      return updated;
    } catch (error) {
      console.error("Could not update schema");
      throw error;
    }
  }
);
