import { Query } from "@/types";
import {
  createQuery,
  deleteQuery,
  getQuery,
  listQueries,
  updateQuery,
} from "../../core/queries";
import { ipcMain } from "electron";

ipcMain.handle("queries:listQueries", async () => {
  try {
    const queries = await listQueries();
    return queries;
  } catch (error) {
    console.error("Could not list queries");
    throw error;
  }
});

ipcMain.handle("queries:getQuery", async (_event, id: number) => {
  try {
    const query = await getQuery(id);
    return query;
  } catch (error) {
    console.error("Could not get query");
    throw error;
  }
});

ipcMain.handle(
  "queries:updateQuery",
  async (_event, id: number, values: Partial<Query>) => {
    try {
      const query = await updateQuery(id, values);
      return query;
    } catch (error) {
      console.error("Could not update query");
      throw error;
    }
  }
);

ipcMain.handle("queries:deleteQuery", async (_event, id: number) => {
  try {
    await deleteQuery(id);
  } catch (error) {
    console.error("Could not delete query");
    throw error;
  }
});

ipcMain.handle(
  "queries:createQuery",
  async (_event, values: Omit<Query, "id ">) => {
    try {
      const query = await createQuery(values);
      return query;
    } catch (error) {
      console.error("Could not create query");
      throw error;
    }
  }
);
