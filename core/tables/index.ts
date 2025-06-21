import { listColumns } from "../columns";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { Table, TableSchema } from "@/types";
import { eq } from "drizzle-orm";

export async function listTables(schemaId: number): Promise<Table[]> {
  const tables = await db
    .select()
    .from(schema.tables)
    .where(eq(schema.tables.schema, schemaId));
  return tables;
}

export async function createTables(
  values: Omit<Table, "id">[]
): Promise<Table[]> {
  const tables = await db.insert(schema.tables).values(values).returning();
  return tables;
}

export async function getTable(id: number): Promise<Table> {
  const [table] = await db
    .select()
    .from(schema.tables)
    .where(eq(schema.tables.id, id));
  return table;
}

export async function deleteTable(id: number): Promise<void> {
  await db.delete(schema.tables).where(eq(schema.tables.id, id));
}

export async function updateTable(id: number, values: Partial<Table>) {
  const [updated] = await db
    .update(schema.tables)
    .set(values)
    .where(eq(schema.tables.id, id))
    .returning();
  return updated;
}

export async function getTableSchema(tableId: number): Promise<TableSchema> {
  const table = await getTable(tableId);
  const columns = await listColumns(table.id);
  return { table, columns };
}
