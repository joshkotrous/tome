import { Column } from "@/types";
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("columns", {
  updateColumn: (id: number, values: Partial<Column>) =>
    ipcRenderer.invoke("columns:updateColumn", id, values),
});
