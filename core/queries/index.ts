import { Query } from "../../src/types";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";
export async function createQuery(values: Omit<Query, "id">): Promise<Query> {
  const [query] = await db.insert(schema.queries).values(values).returning();
  if (!query) {
    throw new Error("Could not create query");
  }
  return query;
}

export async function listQueries(): Promise<Query[]> {
  const queries = await db.select().from(schema.queries);
  return queries;
}

export async function getQuery(id: number): Promise<Query> {
  const [query] = await db
    .select()
    .from(schema.queries)
    .where(eq(schema.queries.id, id));
  if (!query) {
    throw new Error("Could not get query");
  }
  return query;
}

export async function deleteQuery(id: number): Promise<void> {
  await db.delete(schema.queries).where(eq(schema.queries.id, id));
}

export async function updateQuery(id: number, values: Partial<Query>) {
  const [query] = await db
    .update(schema.queries)
    .set(values)
    .where(eq(schema.queries.id, id))
    .returning();
  if (!query) {
    throw new Error("Could not update query");
  }

  return query;
}
