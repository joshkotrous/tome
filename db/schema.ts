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
+
+import * as mysql from "mysql";
+import { encrypt as _encrypt, decrypt as _decrypt } from "../encrypt";
+
+// ---------------------------------------------------------------------------
+// Secret-management helpers
+// ---------------------------------------------------------------------------
+
+const ENC_PREFIX = "enc::"; // simple marker to detect encrypted payloads
+
+async function encryptPassword(password?: string): Promise<string | undefined> {
+  if (!password || password.startsWith(ENC_PREFIX)) return password;
+  const enc = await _encrypt(password);
+  return `${ENC_PREFIX}${enc}`;
+}
+
+async function decryptPassword(password?: string): Promise<string | undefined> {
+  if (!password) return password;
+  if (!password.startsWith(ENC_PREFIX)) return password;
+  const raw = password.slice(ENC_PREFIX.length);
+  return _decrypt(raw);
+}
+
+async function encryptConnection(conn: Connection): Promise<Connection> {
+  const copy: any = { ...conn };
+  if (typeof copy.password === "string") {
+    copy.password = await encryptPassword(copy.password);
+  }
+  return copy as Connection;
+}
+
+async function decryptConnection(conn: Connection): Promise<Connection> {
+  const copy: any = { ...conn };
+  if (typeof copy.password === "string") {
+    copy.password = await decryptPassword(copy.password);
+  }
+  return copy as Connection;
+}
@@
-export async function listDatabases(): Promise<Database[]> {
-  const dbs = await db.select().from(schema.databases);
-  return dbs;
-}
+export async function listDatabases(): Promise<Database[]> {
+  const dbs = await db.select().from(schema.databases);
+  for (const entry of dbs) {
+    entry.connection = await decryptConnection(entry.connection);
+  }
+  return dbs;
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
+  const database = await db
+    .select()
+    .from(schema.databases)
+    .where(eq(schema.databases.id, id));
+  if (!database.length) throw new Error("Database not found");
+  database[0].connection = await decryptConnection(database[0].connection);
+  return database[0];
+}
@@
-export async function createDatabase(
-  values: Omit<Database, "id" | "createdAt">
-): Promise<Database> {
-  // TODO: encrypt password
-  const database = await db.insert(schema.databases).values(values).returning();
-  return database[0];
-}
+export async function createDatabase(
+  values: Omit<Database, "id" | "createdAt">,
+): Promise<Database> {
+  const encConn = await encryptConnection(values.connection as Connection);
+  const inserted = await db
+    .insert(schema.databases)
+    .values({ ...values, connection: encConn })
+    .returning();
+
+  // Decrypt before returning so callers keep current behaviour
+  inserted[0].connection = await decryptConnection(inserted[0].connection);
+  return inserted[0];
+}
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
+  values: Partial<Database>,
+): Promise<Database> {
+  let updatedValues: Partial<Database> = { ...values };
+
+  if (updatedValues.connection) {
+    updatedValues = {
+      ...updatedValues,
+      connection: await encryptConnection(updatedValues.connection as Connection),
+    };
+  }
+
+  const updated = await db
+    .update(schema.databases)
+    .set(updatedValues)
+    .where(eq(schema.databases.id, id))
+    .returning();
+
+  updated[0].connection = await decryptConnection(updated[0].connection);
+  return updated[0];
+}
@@
-  // TODO: decrypt passwords
+  // connection objects stored in the Map are already decrypted because
+  // listDatabases / getDatabase run decryptConnection before returning.
@@
 export function listActive(): Database[] {
   return [...connections.values()].map((e) => e.db);
 }
