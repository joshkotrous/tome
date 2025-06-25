import { Table } from "@/types";
import { updateTable } from "../../core/tables";
import { ipcMain } from "electron";

ipcMain.handle(
  "tables:updateTable",
  async (_event, id: number, values: Partial<Table>) => {
    try {
      const updated = await updateTable(id, values);
      return updated;
    } catch (error) {
      console.error("Could not update table");
      throw error;
    }
  }
);
