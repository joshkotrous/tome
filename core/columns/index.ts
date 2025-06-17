import { eq } from "drizzle-orm";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { Column } from "../../src/types";

export async function listColumns(database: number): Promise<Column[]> {
  const columns = await db
    .select()
    .from(schema.columns)
    .where(eq(schema.columns.database, database));
  return columns;
}

export async function createColumns(
  columns: Omit<Column, "id">[]
): Promise<Column[]> {
  const created = await db.insert(schema.columns).values(columns).returning();
  return created;
}

export async function updateColumn(
  id: number,
  values: Partial<Column>
): Promise<Column> {
  const [updated] = await db
    .update(schema.columns)
    .set(values)
    .where(eq(schema.columns.id, id))
    .returning();
  return updated;
}

export async function deleteColumn(id: number): Promise<void> {
  await db.delete(schema.columns).where(eq(schema.columns.id, id));
}
