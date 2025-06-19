diff --git a/db/schema.ts b/db/schema.ts
@@
   engine: text("engine", { enum: ["Postgres", "MySQL", "SQLite"] })
     .$type<DatabaseEngine>()
     .notNull(),
-  connection: text("connection", { mode: "json" })
-    .$type<Connection>()
-    .notNull(),
+  // Store encrypted credentials; remove automatic JSON handling so that the
+  // ciphertext (base-64 string) is persisted verbatim.
+  connection: text("connection").notNull(),
   createdAt: integer({ mode: "timestamp" }).default(new Date()).notNull(),
 });
diff --git a/core/database/index.ts b/core/database/index.ts
@@
-import { db } from "../../db";
-import * as schema from "../../db/schema";
-import { Connection, Database } from "../../src/types";
-import { eq, inArray } from "drizzle-orm";
-import { Client, Pool as PgPool, QueryResult } from "pg";
-import { ConnectionConfig as MYSQLConnection } from "mysql";
-import { ConnectionConfig as PGConnection } from "pg";
-
-import * as mysql from "mysql";
+import { db } from "../../db";
+import * as schema from "../../db/schema";
+import { Connection, Database } from "../../src/types";
+import { eq, inArray } from "drizzle-orm";
+import { Client, Pool as PgPool, QueryResult } from "pg";
+import { ConnectionConfig as MYSQLConnection } from "mysql";
+import { ConnectionConfig as PGConnection } from "pg";
+import { encrypt, decrypt } from "../encrypt";
+
+import * as mysql from "mysql";
+
+type StoredDatabase = Omit<Database, "connection"> & { connection: string };
+
+async function serializeConnection(conn: Connection): Promise<string> {
+  // Encrypt the full JSON representation so no secrets are left in clear-text.
+  return encrypt(JSON.stringify(conn));
+}
+
+async function deserializeConnection(cipher: string): Promise<Connection> {
+  return JSON.parse(await decrypt(cipher));
+}
+
+async function mapRow(row: StoredDatabase): Promise<Database> {
+  return { ...row, connection: await deserializeConnection(row.connection) };
+}
@@
-export async function listDatabases(): Promise<Database[]> {
-  const dbs = await db.select().from(schema.databases);
-  return dbs;
-}
+export async function listDatabases(): Promise<Database[]> {
+  const rows = (await db.select().from(schema.databases)) as StoredDatabase[];
+  return Promise.all(rows.map(mapRow));
+}
@@
-export async function getDatabase(id: number): Promise<Database> {
-  const database = await db
-    .select()
-    .from(schema.databases)
-    .where(eq(schema.databases.id, id));
-  return database[0];
-}
+export async function getDatabase(id: number): Promise<Database> {
+  const rows = await db
+    .select()
+    .from(schema.databases)
+    .where(eq(schema.databases.id, id));
+
+  if (!rows.length) throw new Error(`Database ${id} not found`);
+  return mapRow(rows[0] as StoredDatabase);
+}
@@
-  // TODO: encrypt password
-  const database = await db.insert(schema.databases).values(values).returning();
-  return database[0];
+  const encryptedConn = await serializeConnection(values.connection);
+  const [row] = await db
+    .insert(schema.databases)
+    .values({ ...values, connection: encryptedConn })
+    .returning();
+
+  return mapRow(row as StoredDatabase);
 }
@@
-export async function updateDatabase(
-  id: number,
-  values: Partial<Database>
-): Promise<Database> {
-  const updated = await db
-    .update(schema.databases)
-    .set(values)
-    .where(eq(schema.databases.id, id))
-    .returning();
-  return updated[0];
-}
+export async function updateDatabase(
+  id: number,
+  values: Partial<Database>
+): Promise<Database> {
+  const pending: Partial<Database | StoredDatabase> = { ...values };
+
+  if (values.connection) {
+    pending.connection = await serializeConnection(
+      values.connection as Connection
+    );
+  }
+
+  const [row] = await db
+    .update(schema.databases)
+    .set(pending)
+    .where(eq(schema.databases.id, id))
+    .returning();
+
+  return mapRow(row as StoredDatabase);
+}
@@
-  // TODO: decrypt passwords
-
   switch (db.engine) {
