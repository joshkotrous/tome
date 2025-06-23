import { IndexJob } from "@/types";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { and, eq } from "drizzle-orm";
export async function createIndexJob(
  values: Omit<IndexJob, "id" | "completedAt">
): Promise<IndexJob> {
  const [created] = await db
    .insert(schema.indexJobs)
    .values(values)
    .returning();
  return created;
}

export async function listIndexJobs(filter: {
  connection: number;
  status?: IndexJob["status"];
}): Promise<IndexJob[]> {
  if (filter.status) {
    const indexJobs = await db
      .select()
      .from(schema.indexJobs)
      .where(
        and(
          eq(schema.indexJobs.connection, filter.connection),
          eq(schema.indexJobs.status, filter.status)
        )
      );
    return indexJobs;
  }

  const indexJobs = await db
    .select()
    .from(schema.indexJobs)
    .where(eq(schema.indexJobs.connection, filter.connection));
  return indexJobs;
}

export async function updateIndexJob(
  id: number,
  values: Partial<IndexJob>
): Promise<IndexJob> {
  const [updated] = await db
    .update(schema.indexJobs)
    .set(values)
    .where(eq(schema.indexJobs.id, id))
    .returning();
  return updated;
}
