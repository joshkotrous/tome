import { Table } from "@/types";
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("tables", {
  updateTable: (id: number, values: Partial<Table>) =>
    ipcRenderer.invoke("tables:updateTable", id, values),
});
