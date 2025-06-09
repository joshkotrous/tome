import { db } from "../../db";
import * as schema from "../../db/schema";
import { AIProvider, Conversation } from "../../src/types";
import { getResponse } from "../ai";
import { desc, eq } from "drizzle-orm";

export async function updateConversation(
  id: number,
  values: Partial<Conversation>
): Promise<Conversation> {
  const [conversation] = await db
    .update(schema.conversations)
    .set(values)
    .where(eq(schema.conversations.id, id))
    .returning();

  if (!conversation) {
    throw new Error("Could not update conversation");
  }

  return conversation;
}

async function generateConversationTitle(
  message: string,
  conversation: Conversation,
  shouldGenerate: boolean,
  aiOptions: { provider: AIProvider; apiKey: string }
): Promise<string> {
  if (!shouldGenerate) {
    return truncateMessage(message);
  }

  try {
    const response = await getResponse({
      provider: aiOptions.provider,
      apiKey: aiOptions.apiKey,
      prompt: `Generate a concise, descriptive title (max 50 characters) for this chat message: "${message}"`,
      system:
        "You are a helpful assistant that creates brief, clear titles for conversations. Return only the title, no quotes or additional text.",
    });

    const name = response.text.trim() || truncateMessage(message);

    await updateConversation(conversation.id, { name });

    return name;
  } catch (error) {
    console.warn(
      "Failed to generate AI title, falling back to truncated message:",
      error
    );
    return truncateMessage(message);
  }
}

function truncateMessage(message: string, maxLength: number = 50): string {
  if (message.length <= maxLength) {
    return message;
  }
  return message.slice(0, maxLength).trim() + "...";
}

export async function createConversation(
  initialMessage: string,
  options: {
    provider: AIProvider;
    apiKey: string;
    generateTitle?: boolean;
  }
): Promise<Conversation> {
  const { provider, apiKey, generateTitle = true } = options;

  try {
    const [conversation] = await db
      .insert(schema.conversations)
      .values({ name: "" })
      .returning();

    if (!conversation) {
      throw new Error("Database insertion failed - no conversation returned");
    }

    generateConversationTitle(initialMessage, conversation, generateTitle, {
      provider,
      apiKey,
    });

    return conversation;
  } catch (error) {
    throw new Error(
      `Failed to create conversation: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function getConversation(id: number): Promise<Conversation> {
  const [conversation] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, id));

  if (!conversation) {
    throw new Error("Conversation could not be found");
  }

  return conversation;
}

export async function deleteConversation(id: number): Promise<void> {
  await db.delete(schema.conversations).where(eq(schema.conversations.id, id));
}

export async function listConversations(): Promise<Conversation[]> {
  const conversations = await db
    .select()
    .from(schema.conversations)
    .orderBy(desc(schema.conversations.createdAt));
  return conversations;
}
