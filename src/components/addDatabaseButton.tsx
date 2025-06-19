import { db } from "../../db";
import * as schema from "../../db/schema";
import { Connection, Database } from "../../src/types";
import { eq, inArray } from "drizzle-orm";
import { Client, Pool as PgPool, QueryResult } from "pg";
import { ConnectionConfig as MYSQLConnection } from "mysql";
import { ConnectionConfig as PGConnection } from "pg";
import * as mysql from "mysql";
// --- encryption helpers --------------------------------------------------
import { encrypt, decrypt } from "../encrypt";

const ENC_PREFIX = "enc:";

async function maybeEncryptPassword(pwd?: string): Promise<string | undefined> {
  if (!pwd) return pwd;
  return pwd.startsWith(ENC_PREFIX) ? pwd : `${ENC_PREFIX}${await encrypt(pwd)}`;
}

async function maybeDecryptPassword(pwd?: string): Promise<string | undefined> {
  if (!pwd || !pwd.startsWith(ENC_PREFIX)) return pwd;
  return await decrypt(pwd.slice(ENC_PREFIX.length));
}

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
  values: Omit<Database, "id" | "createdAt">
): Promise<Database> {
  const cloned = structuredClone(values);
  // transparently encrypt the password before persisting
  if (typeof cloned.connection?.password === "string") {
    cloned.connection.password = await maybeEncryptPassword(
      cloned.connection.password
    );
  }
  const database = await db.insert(schema.databases).values(cloned).returning();
  return database[0];
}

export async function deleteDatabases(ids: number[]): Promise<void> {
  await db.delete(schema.databases).where(inArray(schema.databases.id, ids));
}

export async function updateDatabase(
  id: number,
  values: Partial<Database>
): Promise<Database> {
  const upd = structuredClone(values);
  if (upd.connection && typeof upd.connection.password === "string") {
    upd.connection.password = await maybeEncryptPassword(
      upd.connection.password
    );
  }
  const updated = await db
    .update(schema.databases)
    .set(upd)
    .where(eq(schema.databases.id, id))
    .returning();
  return updated[0];
}

export async function testConnection(
  dbEntry: Omit<Database, "id">
): Promise<{ success: boolean; error: string }> {
  switch (dbEntry.engine) {
    case "Postgres":
      return await testPostgresConnection(dbEntry.connection);
    default:
      throw new Error("Unsupported engine");
  }
}

async function testPostgresConnection(
  connIn: Connection
): Promise<{ success: boolean; error: string }> {
  const connection: any = { ...connIn };
  if (typeof connection.password === "string") {
    connection.password = await maybeDecryptPassword(connection.password);
  }

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

export async function connect(dbEntry: Database): Promise<ConnectionEntry> {
  const existing = connections.get(dbEntry.id);
  if (existing) return existing;

  let entry: ConnectionEntry;
  const connCopy: any = { ...dbEntry.connection };

  if (typeof connCopy.password === "string") {
    connCopy.password = await maybeDecryptPassword(connCopy.password);
  }

  switch (dbEntry.engine) {
    case "Postgres": {
      const pool = new PgPool(connCopy as PGConnection);
      await pool.query("SELECT 1");
      entry = { db: dbEntry, driver: pool };
      break;
    }

    case "MySQL": {
      const conn = mysql.createConnection(connCopy as MYSQLConnection);
      conn.ping();
      entry = { db: dbEntry, driver: conn };
      break;
    }

    default:
      throw new Error(`Unsupported engine ${dbEntry.engine as string}`);
  }

  connections.set(dbEntry.id, entry);
  return entry;
}

export async function disconnect(db: Database): Promise<void> {
  const entry = connections.get(db.id);
  if (!entry) return;

  const { driver } = entry;
  if (driver instanceof PgPool) await driver.end();
  else if ("end" in driver) await (driver as mysql.Connection).end();
  connections.delete(db.id);
}

export function listActive(): Database[] {
  return [...connections.values()].map((e) => e.db);
}

export interface JsonQueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
}

function toJsonResult(
  engine: Database["engine"],
  result: any
): JsonQueryResult {
  switch (engine) {
    case "Postgres": {
      const pgRes = result as QueryResult<any>;
      return {
        columns: pgRes.fields.map((f) => f.name),
        rows: pgRes.rows,
        rowCount: pgRes.rowCount ?? 0,
      };
    }
    case "MySQL": {
      const [rows, fields] = result as [any[], mysql.FieldInfo[]];
      return {
        columns: fields.map((f) => f.name),
        rows,
        rowCount: rows.length,
      };
    }
    case "SQLite": {
      const rows = result as any[];
      return {
        columns: rows.length ? Object.keys(rows[0]) : [],
        rows,
        rowCount: rows.length,
      };
    }
    default:
      throw new Error(`Unsupported engine ${engine as string}`);
  }
}

export async function query(
  db: Database,
  sql: string,
  params: any[] = []
): Promise<JsonQueryResult> {
  const entry = connections.get(db.id) ?? (await connect(db));
  const { driver } = entry;

  switch (db.engine) {
    case "Postgres": {
      const native = await (driver as PgPool).query(sql, params);
      return toJsonResult("Postgres", native);
    }
    case "MySQL": {
      const native = await new Promise<any>((resolve, reject) =>
        (driver as mysql.Connection).query(sql, params, (err, rows, fields) =>
          err ? reject(err) : resolve([rows, fields])
        )
      );
      return toJsonResult("MySQL", native);
    }
    case "SQLite": {
      const stmt = (driver as any).prepare(sql);
      const native =
        Array.isArray(params) && params.length
          ? stmt.all(...params)
          : stmt.all();
      return toJsonResult("SQLite", native);
    }
    default:
      throw new Error(`Unsupported engine ${db.engine as string}`);
  }
}

// The rest of the file (schema helpers, etc.) remains unchanged
