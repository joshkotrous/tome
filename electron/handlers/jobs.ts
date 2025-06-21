import { IndexJob } from "@/types";
import { listIndexJobs } from "../../core/jobs";
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
