import { Query } from "@/types";
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("queries", {
  listQueries: () => ipcRenderer.invoke("queries:listQueries"),
  getQuery: (id: number) => ipcRenderer.invoke("queries:getQuery", id),
  updateQuery: (id: number, values: Partial<Query>) =>
    ipcRenderer.invoke("queries:updateQuery", id, values),
  deleteQuery: (id: number) => ipcRenderer.invoke("queries:deleteQuery", id),
  createQuery: (values: Omit<Query, "id">) =>
    ipcRenderer.invoke("queries:createQuery", values),
});
