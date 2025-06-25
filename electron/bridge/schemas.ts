import { Schema } from "@/types";
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("schemas", {
  updateSchema: (id: number, values: Partial<Schema>) =>
    ipcRenderer.invoke("schemas:updateSchema", id, values),
});
