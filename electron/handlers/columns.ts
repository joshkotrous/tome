import { Column } from "@/types";
import { updateColumn } from "../../core/columns";
import { ipcMain } from "electron";

ipcMain.handle(
  "columns:updateColumn",
  async (_event, id: number, values: Partial<Column>) => {
    try {
      const updated = await updateColumn(id, values);
      return updated;
    } catch (error) {
      console.error("Could not update column");
      throw error;
    }
  }
);
