import { Connection, IndexJob } from "@/types";
import { listIndexJobs } from "../../core/jobs";
import { indexConnection } from "../../core/semanticIndex";
import { ipcMain } from "electron";

ipcMain.handle(
  "jobs:listIndexJobs",
  async (_event, connection: number, status?: IndexJob["status"]) => {
    try {
      const indexJobs = await listIndexJobs({ connection, status });
      return indexJobs;
    } catch (err) {
      console.error("Failed to get index jobs:", err);
      throw err;
    }
  }
);

ipcMain.handle(
  "jobs:updateSemanticIndex",
  async (_event, connection: Connection) => {
    try {
      const result = await indexConnection(connection, true);
      return result;
    } catch (err) {
      console.error("Failed to update semantic index:", err);
      throw err;
    }
  }
);
