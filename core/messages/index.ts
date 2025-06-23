import { TomeMessage } from "../../src/types";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { asc, eq } from "drizzle-orm";

export async function createMessage(
  values: Omit<TomeMessage, "id" | "createdAt">
): Promise<TomeMessage> {
  const [message] = await db
    .insert(schema.messages)
    .values({ ...values, createdAt: new Date() })
    .returning();
  if (!message) {
    throw new Error("Could not create message");
  }
  return message;
}

export async function listMessages(
  conversation?: number,
  query?: number
): Promise<TomeMessage[]> {
  if (conversation) {
    const messages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversation, conversation))
      .orderBy(asc(schema.messages.createdAt));
    return messages;
  }

  if (query) {
    const messages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.query, query))
      .orderBy(asc(schema.messages.createdAt));
    return messages;
  }

  throw new Error("One of conversation or message must be provided");
}

export async function updateMessage(
  id: string,
  values: Partial<TomeMessage>
): Promise<TomeMessage> {
  const [updated] = await db
    .update(schema.messages)
    .set(values)
    .where(eq(schema.messages.id, id))
    .returning();
  return updated;
}
