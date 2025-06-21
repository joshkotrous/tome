import { IndexJob } from "@/types";
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("jobs", {
  listIndexJobs: (connection: number, status?: IndexJob["status"]) =>
    ipcRenderer.invoke("jobs:listIndexJobs", connection, status),
});
