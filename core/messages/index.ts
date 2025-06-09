import { ConversationMessage } from "../../src/types";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { desc, eq } from "drizzle-orm";

export async function createMessage(
  values: Omit<ConversationMessage, "id" | "createdAt">
): Promise<ConversationMessage> {
  const [message] = await db.insert(schema.messages).values(values).returning();
  if (!message) {
    throw new Error("Could not create message");
  }
  return message;
}

export async function listMessages(
  conversation: number
): Promise<ConversationMessage[]> {
  const messages = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversation, conversation))
    .orderBy(desc(schema.messages.createdAt));
  return messages;
}
