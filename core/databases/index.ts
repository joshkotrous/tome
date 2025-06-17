import { eq } from "drizzle-orm";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { Database } from "../../src/types";

export async function listDatabases(connection: number): Promise<Database[]> {
  const databases = await db
    .select()
    .from(schema.databases)
    .where(eq(schema.databases.connection, connection));
  return databases;
}

export async function createDatabases(
  values: Omit<Database, "id">[]
): Promise<Database[]> {
  const created = await db.insert(schema.databases).values(values).returning();
  return created;
}

export async function updateDatabase(
  id: number,
  values: Partial<Database>
): Promise<Database> {
  const [updated] = await db
    .update(schema.databases)
    .set(values)
    .where(eq(schema.databases.id, id))
    .returning();
  return updated;
}

export async function deleteDatabase(id: number): Promise<void> {
  await db.delete(schema.databases).where(eq(schema.databases.id, id));
}
