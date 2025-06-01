import { db } from "../../electron/main";
import * as schema from "../../db/schema";
import { Connection, Database } from "../../src/types";
import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";

export async function listDatabases(): Promise<Database[]> {
  const dbs = await db.select().from(schema.databases);
  return dbs;
}

export async function getDatabase(id: number): Promise<Database> {
  const database = await db
    .select()
    .from(schema.databases)
    .where(eq(schema.databases.id, id));
  return database[0];
}

export async function createDatabase(
  values: Omit<Database, "id">
): Promise<Database> {
  const database = await db.insert(schema.databases).values(values).returning();
  return database[0];
}

export async function deleteDatabases(ids: number[]): Promise<void> {
  await db.delete(schema.databases).where(inArray(schema.databases.id, ids));
}

export async function updateDatabase(
  id: number,
  values: Partial<Database>
): Promise<Database> {
  const updated = await db
    .update(schema.databases)
    .set(values)
    .where(eq(schema.databases.id, id))
    .returning();
  return updated[0];
}

export async function testConnection(
  db: Omit<Database, "id">
): Promise<{ success: boolean; error: string }> {
  switch (db.engine) {
    case "Postgres":
      return await testPostgresConnection(db.connection);
      break;
    default:
      throw new Error("Unsupported engine");
  }
}

async function testPostgresConnection(
  connection: Connection
): Promise<{ success: boolean; error: string }> {
  const client = new Client({
    host: connection.host,
    port: connection.port ?? 5432,
    database: connection.database,
    user: connection.username,
    password: connection.password,
    ssl: connection.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5_000,
  });

  try {
    await client.connect();
    await client.query("SELECT 1");
    return { success: true, error: "" };
  } catch (err) {
    console.error("Postgres connection test failed:", err);
    return { success: false, error: String(err) };
  } finally {
    await client.end().catch(() => undefined);
  }
}
