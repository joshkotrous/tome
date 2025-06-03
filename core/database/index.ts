import { db } from "../../electron/main";
import * as schema from "../../db/schema";
import { Connection, Database } from "../../src/types";
import { eq, inArray } from "drizzle-orm";
import { Client, Pool as PgPool, QueryResult } from "pg";
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
export interface JsonQueryResult {
  /** ordered list of column names, e.g. ["id", "name", …]            */
  columns: string[];
  /** array of row objects                                             */
  rows: any[];
  /** convenience duplicate of rows.length (or pg’s rowCount)          */
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
    /* --------------------------- POSTGRES -------------------------- */
    case "Postgres": {
      const native = await (driver as PgPool).query(sql, params);
      return toJsonResult("Postgres", native);
    }

    /* ---------------------------- MYSQL ---------------------------- */
    case "MySQL": {
      const native = await new Promise<any>((resolve, reject) =>
        (driver as mysql.Connection).query(sql, params, (err, rows, fields) =>
          err ? reject(err) : resolve([rows, fields])
        )
      );
      return toJsonResult("MySQL", native);
    }

    /* --------------------------- SQLITE --------------------------- */
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

export async function listRemoteDatabases(db: Database): Promise<string[]> {
  const { driver } = await connect(db);

  switch (db.engine) {
    case "Postgres": {
      // pg.Pool#query returns { rows: {datname: string}[] }
      const res = await (driver as PgPool).query<{ datname: string }>(
        `SELECT datname
           FROM pg_database
          WHERE datistemplate = FALSE
            AND datallowconn = TRUE
          ORDER BY datname;`
      );
      return res.rows.map((r) => r.datname);
    }

    case "MySQL": {
      // mysql's .query returns (err, rows, fields) – wrap for a promise
      const rows = await new Promise<{ Database: string }[]>(
        (resolve, reject) =>
          (driver as mysql.Connection).query("SHOW DATABASES", (err, rows) =>
            err ? reject(err) : resolve(rows as any)
          )
      );
      return rows.map((r) => r.Database);
    }

    case "SQLite": {
      // One file == one “database”
      return [db.connection.database ?? ""];
    }

    default:
      throw new Error(`Unsupported engine ${db.engine as string}`);
  }
}

export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

export interface TableDef {
  table: string;
  columns: ColumnDef[];
}

export async function listSchemas(
  db: Database,
  targetDb?: string
): Promise<string[]> {
  const sameDb =
    !targetDb || targetDb === db.connection.database || !db.connection.database;

  /* ------------------------  POSTGRES  ------------------------ */
  if (db.engine === "Postgres") {
    const pool: PgPool = sameDb
      ? ((await connect(db)).driver as PgPool)
      : new PgPool({ ...(db.connection as PGConnection), database: targetDb });

    try {
      const res = await pool.query<{ schema_name: string }>(`
        SELECT schema_name
          FROM information_schema.schemata
         WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
         ORDER BY schema_name;
      `);
      return res.rows.map((r) => r.schema_name);
    } finally {
      if (!sameDb) await pool.end();
    }
  }

  /* -------------------------  MYSQL  -------------------------- */
  // if (db.engine === "MySQL") {
  //   // MySQL’s “schema” == “database” → one per connection
  //   return [targetDb ?? db.connection.database];
  // }

  /* ------------------------  SQLITE  -------------------------- */
  // if (db.engine === "SQLite") {
  //   // Only the default 'main' schema (optionally 'temp')
  //   return ["main"];
  // }

  throw new Error(`Unsupported engine ${db.engine as string}`);
}

export async function listSchemaTables(
  db: Database,
  targetSchema: string,
  targetDb?: string
): Promise<TableDef[]> {
  const sameDb =
    !targetDb || targetDb === db.connection.database || !db.connection.database;

  if (db.engine === "Postgres") {
    const pool: PgPool = sameDb
      ? ((await connect(db)).driver as PgPool)
      : new PgPool({ ...(db.connection as PGConnection), database: targetDb });

    try {
      const res = await pool.query<{
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: "YES" | "NO";
        column_default: string | null;
      }>(
        `
        SELECT table_name,
               column_name,
               data_type,
               is_nullable,
               column_default
          FROM information_schema.columns
         WHERE table_schema = $1
         ORDER BY table_name, ordinal_position;
        `,
        [targetSchema]
      );

      const map = new Map<string, TableDef>();
      for (const r of res.rows) {
        if (!map.has(r.table_name))
          map.set(r.table_name, { table: r.table_name, columns: [] });
        map.get(r.table_name)!.columns.push({
          name: r.column_name,
          type: r.data_type,
          nullable: r.is_nullable === "YES",
          default: r.column_default,
        });
      }
      return [...map.values()];
    } finally {
      if (!sameDb) await pool.end();
    }
  }

  // if (db.engine === "MySQL") {
  //   // In MySQL a “schema” *is* a database; validate the request.
  //   const schemaName = targetDb ?? db.connection.database;
  //   if (targetSchema && targetSchema !== schemaName) {
  //     throw new Error(
  //       `MySQL: targetSchema should match the database name (` +
  //         `'${schemaName}'), got '${targetSchema}'.`
  //     );
  //   }

  //   const rows = await new Promise<
  //     {
  //       TABLE_NAME: string;
  //       COLUMN_NAME: string;
  //       DATA_TYPE: string;
  //       IS_NULLABLE: "YES" | "NO";
  //       COLUMN_DEFAULT: string | null;
  //     }[]
  //   >((resolve, reject) =>
  //     (
  //       await connect(db)
  //     ).driver.query(
  //       `
  //       SELECT TABLE_NAME,
  //              COLUMN_NAME,
  //              DATA_TYPE,
  //              IS_NULLABLE,
  //              COLUMN_DEFAULT
  //         FROM information_schema.columns
  //        WHERE table_schema = ?
  //        ORDER BY TABLE_NAME, ORDINAL_POSITION;
  //       `,
  //       [schemaName],
  //       (err: any, rows: any[]) => (err ? reject(err) : resolve(rows as any))
  //     )
  //   );

  //   const map = new Map<string, TableDef>();
  //   for (const r of rows) {
  //     if (!map.has(r.TABLE_NAME))
  //       map.set(r.TABLE_NAME, { table: r.TABLE_NAME, columns: [] });
  //     map.get(r.TABLE_NAME)!.columns.push({
  //       name: r.COLUMN_NAME,
  //       type: r.DATA_TYPE,
  //       nullable: r.IS_NULLABLE === "YES",
  //       default: r.COLUMN_DEFAULT,
  //     });
  //   }
  //   return [...map.values()];
  // }

  // if (db.engine === "SQLite") {
  //   if (targetDb && targetDb !== db.connection.database) {
  //     throw new Error(
  //       "SQLite connection is tied to the file on disk — open a new file to inspect it."
  //     );
  //   }
  //   if (targetSchema && targetSchema !== "main") {
  //     throw new Error("SQLite only exposes the default 'main' schema.");
  //   }

  //   const driver = (await connect(db)).driver as any;
  //   const tables: { name: string }[] = await new Promise((resolve, reject) =>
  //     driver.all(
  //       `SELECT name FROM sqlite_master
  //         WHERE type = 'table' AND name NOT LIKE 'sqlite_%';`,
  //       (err: any, rows: any[]) => (err ? reject(err) : resolve(rows))
  //     )
  //   );

  //   const result: TableDef[] = [];
  //   for (const { name } of tables) {
  //     const cols = await new Promise<
  //       {
  //         name: string;
  //         type: string;
  //         notnull: 0 | 1;
  //         dflt_value: string | null;
  //       }[]
  //     >((resolve, reject) =>
  //       driver.all(`PRAGMA table_info(${name});`, (err: any, rows: any[]) =>
  //         err ? reject(err) : resolve(rows)
  //       )
  //     );
  //     result.push({
  //       table: name,
  //       columns: cols.map((c) => ({
  //         name: c.name,
  //         type: c.type,
  //         nullable: c.notnull === 0,
  //         default: c.dflt_value,
  //       })),
  //     });
  //   }
  //   return result;
  // }

  throw new Error(`Unsupported engine ${db.engine as string}`);
}

export interface DatabaseSchema {
  database: string;
  schemas: SchemaInfo[];
}

export interface SchemaInfo {
  name: string;
  tables: TableDef[];
}

export async function getFullSchema(
  db: Database,
  targetDb?: string
): Promise<DatabaseSchema> {
  const databaseName = targetDb || db.connection.database || "default";

  try {
    // Get all schemas in the database
    const schemaNames = await listSchemas(db, targetDb);

    // Get tables for each schema
    const schemas: SchemaInfo[] = [];

    for (const schemaName of schemaNames) {
      try {
        const tables = await listSchemaTables(db, schemaName, targetDb);
        schemas.push({
          name: schemaName,
          tables,
        });
      } catch (error) {
        console.warn(
          `Failed to fetch tables for schema '${schemaName}':`,
          error
        );
        // Continue with other schemas even if one fails
        schemas.push({
          name: schemaName,
          tables: [],
        });
      }
    }

    return {
      database: databaseName,
      schemas,
    };
  } catch (error) {
    console.error(
      `Failed to fetch full schema for database '${databaseName}':`,
      error
    );
    throw new Error(
      `Unable to retrieve schema for database '${databaseName}': ${error}`
    );
  }
}
