import { Schema, SchemaDef } from "@/types";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";
import { listTables } from "../tables";

export async function listSchemas(database: number): Promise<Schema[]> {
  const schemas = await db
    .select()
    .from(schema.schemas)
    .where(eq(schema.schemas.database, database));
  return schemas;
}

export async function createSchemas(
  values: Omit<Schema, "id">[]
): Promise<Schema[]> {
  const created = await db.insert(schema.schemas).values(values).returning();
  return created;
}

export async function updateSchema(
  id: number,
  values: Partial<Schema>
): Promise<Schema> {
  const [updated] = await db
    .update(schema.schemas)
    .set(values)
    .where(eq(schema.schemas.id, id))
    .returning();
  return updated;
}

export async function getSchema(id: number): Promise<Schema> {
  const [schma] = await db
    .select()
    .from(schema.schemas)
    .where(eq(schema.schemas.id, id));
  return schma;
}

export async function deleteSchema(id: number): Promise<void> {
  await db.delete(schema.schemas).where(eq(schema.schemas.id, id));
}

export async function getSchemaDef(schemaId: number): Promise<SchemaDef> {
  const schma = await getSchema(schemaId);
  const tables = await listTables(schma.id);
  return { schema: schma, tables };
}
