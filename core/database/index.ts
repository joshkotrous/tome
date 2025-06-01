import { db } from "../../electron/main";
import * as schema from "../../db/schema";
import { Connection, Database } from "../../src/types";
import { eq, inArray } from "drizzle-orm";
import { Client, Pool as PgPool } from "pg";
import { ConnectionConfig as MYSQLConnection } from "mysql";
import { ConnectionConfig as PGConnection } from "pg";

import * as mysql from "mysql";

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
    user: connection.user,
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

type Driver = PgPool | mysql.Connection;

type ConnectionEntry = { db: Database; driver: Driver };

const connections = new Map<number, ConnectionEntry>();

export async function connect(db: Database): Promise<ConnectionEntry> {
  const existing = connections.get(db.id);
  if (existing) return existing;

  let entry: ConnectionEntry;

  switch (db.engine) {
    case "Postgres": {
      const pool = new PgPool(db.connection as PGConnection);
      await pool.query("SELECT 1"); // smoke-test
      entry = { db, driver: pool };
      break;
    }

    case "MySQL": {
      const conn = mysql.createConnection(db.connection as MYSQLConnection);
      conn.ping();
      entry = { db, driver: conn };
      break;
    }

    default:
      throw new Error(`Unsupported engine ${db.engine as string}`);
  }

  connections.set(db.id, entry);
  return entry;
}

export async function disconnect(db: Database): Promise<void> {
  const entry = connections.get(db.id);
  if (!entry) return;

  const { driver } = entry;

  if (driver instanceof PgPool) await driver.end();
  else if ("end" in driver) await (driver as mysql.Connection).end();
  /* else sqlite.close() … */

  connections.delete(db.id);
}

export function listActive(): Database[] {
  return [...connections.values()].map((e) => e.db);
}

export async function query(
  db: Database, // which DB to run against
  sql: string,
  params: any[] = []
) {
  let entry = connections.get(db.id);
  if (!entry) {
    entry = await connect(db);
  }

  const { driver } = entry;

  switch (db.engine) {
    case "Postgres": {
      // pg returns { rows, rowCount, … }
      return (driver as PgPool).query(sql, params);
    }

    //   case "MySQL": {
    //     // mysql2 returns [rows, fields]
    //     const [rows] = await (driver as mysql.Connection).execute(sql, params);
    //     return rows;
    //   }

    //   case "SQLite": {
    //     // better-sqlite3 is synchronous; wrap so caller always gets a Promise
    //     const stmt = (driver as sqlite3.Database).prepare(sql);
    //     const rows = Array.isArray(params) && params.length
    //       ? stmt.all(...params)
    //       : stmt.all();
    //     return rows;
    //   }

    default:
      throw new Error(`Unsupported engine ${db.engine as string}`);
  }
}
