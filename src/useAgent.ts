// useAgent.ts --------------------------------------------------------------
import { useRef, useState, useCallback, Dispatch, SetStateAction } from "react";
import { tool } from "ai";
import { useDB } from "./databaseConnectionProvider";
import { streamResponse, TomeAgentModel, ToolMap } from "../core/ai";
import { z } from "zod";
import { useAppData } from "./applicationDataProvider";
import { useQueryData } from "./queryDataProvider";
import { nanoid } from "nanoid";
import { ConversationMessage } from "./types";

interface UseAgentOptions {
  messages?: ConversationMessage[];
  setMessages?: Dispatch<SetStateAction<ConversationMessage[]>>;
}

/*
 * A very small allow-list validator that prevents the AI tool from executing
 * any SQL statement that could modify database state. Only read-only commands
 * such as SELECT, WITH, SHOW, DESCRIBE and EXPLAIN are permitted.  Anything
 * else (or multiple statements separated by a semicolon) will be rejected.
 *
 * NOTE: This is a defence-in-depth measure and intentionally simple; it does
 * not try to do full SQL parsing, but it blocks the most dangerous keywords
 * and multi-statement payloads that are sufficient for privilege-escalation
 * or data-destruction attacks.
 */
function isReadOnlyQuery(query: string): boolean {
  const cleaned = query
    // strip single-line comments
    .replace(/--.*?(\n|$)/g, "")
    // strip multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  // Disallow multiple statements
  if (cleaned.includes(";")) {
    return false;
  }

  // Reject any forbidden keyword (mutating / DDL / privilege commands)
  const forbidden = /(\bALTER\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|\bGRANT\b|\bREVOKE\b|\bCREATE\b|\bMERGE\b|\bCALL\b|\bREPLACE\b)/i;
  if (forbidden.test(cleaned)) {
    return false;
  }

  // Allow only recognised read-only commands at the beginning of the query
  const allowedStarters = /^(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)\b/i;
  return allowedStarters.test(cleaned);
}

export function useAgent(options: UseAgentOptions = {}) {
  const { connect, connected } = useDB();
  const { runQuery } = useQueryData();
  const { settings, databases } = useAppData();

  // Use external state if provided, otherwise use internal state
  const [internalMsgs, setInternalMsgs] = useState<ConversationMessage[]>([]);
  const msgs = options.messages ?? internalMsgs;
  const setMsgs = options.setMessages ?? setInternalMsgs;

  const [thinking, setThinking] = useState(false);
  const abortRef = useRef<AbortController>();

  async function getConnection(connectionName: string, connectionId: number) {
    let conn =
      connected.find(
        (i) => i.name === connectionName && i.id === connectionId
      ) ?? null;
    if (!conn) {
      const db = databases.find((i) => i.id === connectionId);
      if (!db) {
        throw new Error(`Could not find ${connectionId}`);
      }
      conn = await connect(db);
    }
    if (!conn) {
      throw new Error(`Could not connect to ${connectionId}:${connectionName}`);
    }
    return conn;
  }

  async function getFullSchema(connectionName: string, connectionId: number) {
    const conn = await getConnection(connectionName, connectionId);
    const schema = await window.db.getFullSchema(conn);
    return schema;
  }

  async function executeQuery(
    connectionName: string,
    connectionId: number,
    query: string
  ) {
    // Prevent destructive queries from being executed by the AI tool
    if (!isReadOnlyQuery(query)) {
      return {
        error:
          "Blocked potentially destructive or unsupported SQL statement. Only read-only queries are allowed via AI tool.",
      } as const;
    }

    const conn = await getConnection(connectionName, connectionId);
    const res = await runQuery({ id: nanoid(4), connection: conn, query });
    return res && "error" in res
      ? res
      : { totalCount: res?.rowCount, records: res?.rows.splice(0, 5) ?? [] };
  }

  const tools: ToolMap = {
    runQuery: tool({
      description:
        "Run a read-only SQL query (SELECT/SHOW/DESCRIBE/EXPLAIN) and return JSON rows. Mutating or DDL statements are not allowed.",
      parameters: z.object({
        query: z.string(),
        connectionId: z.number(),
        connectionName: z.string(),
      }),
      execute: async ({ query, connectionId, connectionName }) =>
        JSON.stringify(await executeQuery(connectionName, connectionId, query)),
    }),
    getSchema: tool({
      description:
        "Gets the full schema for a given connection. Used to get more context about the db you're querying to know what tables/columns you have access to",
      parameters: z.object({
        connectionId: z.number(),
        connectionName: z.string(),
      }),
      execute: async ({ connectionId, connectionName }) =>
        JSON.stringify(await getFullSchema(connectionName, connectionId)),
    }),
  };

  const send = useCallback(
    async (
      text: string,
      model: TomeAgentModel,
      conversation?: number | null
    ) => {
      if (!settings) {
        console.warn("Could not get settings");
        return;
      }
      if (!settings.aiFeatures.apiKey) {
        console.warn("API Key is not configured");
        return;
      }
      if (!settings.aiFeatures.provider) {
        console.warn("Provider is not configured");
        return;
      }

      if (!conversation) {
        const newConversation = await window.conversations.createConversation(
          text
        );
        conversation = newConversation.id;
      }

      const updatedMessages = [
        ...msgs,
        {
          role: "user" as const,
          content: text,
          createdAt: new Date(),
          conversation,
          id: 1,
        },
      ];
      setMsgs(updatedMessages);

      if (conversation) {
        window.messages.createMessage({
          content: text,
          role: "user",
          conversation,
        });
      }

      setThinking(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const systemPrompt = `You are an AI assistant embedded in a database client UI. Your role is to help the user with any request, using the available tools and database connections listed below:
      <databases>
      ${JSON.stringify(databases, null, 2)}
      </databases>
      
      **Behavior Guidelines:**
      - If a request requires a connection, use \`connectionName\` and \`connectionId\` from the <databases> list.
      - If the user does not specify a database and multiple are available, ask them to choose.
      - When returning query results, always:
        - Show them in **table format**
        - Include the **query used**
        - Display only a **summary (a few records)**, not the full result set
      - If asked to write a query, default to **executing it** unless it's **mutable or destructive**
      - Always show any **queries you executed**
      - End every response with a UI action tag: \`<ui_action>{action}</ui_action>\`
      - Default to providing a summary of the query data including the total rows 
      - If you're asked to run query or aggregate data without much context, query for data until you find one that returns more than 0 rows.
      
      **Query Instructions:**
      - When working with postgres and you encounter a column in camel-case format, it must be wrapped with double quotes.
      - Do not default to adding a limit to your queries unless requested
      **UI Action Instructions:**
      - If you need permission to run a query, set \`<ui_action>approve-query</ui_action>\`
      - Otherwise, use \`<ui_action></ui_action>\` if no action is needed.
      `;

      const streamResult = streamResponse({
        model,
        tools,
        messages: updatedMessages,
        system: systemPrompt,
        apiKey: settings.aiFeatures.apiKey,
        provider: settings.aiFeatures.provider,
      });

      // Handle text streaming
      for await (const textPart of streamResult.textStream) {
        setMsgs((m) => {
          const last = m[m.length - 1];
          // append or start new chunk
          if (last?.role === "assistant" && !(last as any).toolTag) {
            return [
              ...m.slice(0, -1),
              { ...last, content: last.content + textPart },
            ];
          }
          return [
            ...m,
            {
              id: 1,
              role: "assistant",
              content: textPart,
              createdAt: new Date(),
              conversation,
            },
          ];
        });
      }

      // Get the final result to access tool calls and results
      const finalResult = await streamResult;
      const finalText = await streamResult.text;

      if (conversation) {
        window.messages.createMessage({
          content: finalText,
          role: "assistant",
          conversation,
        });
      }

      // Get tool calls and results
      const toolCalls = await finalResult.toolCalls;
      const toolResults = await finalResult.toolResults;

      // If there were tool calls, add them to the conversation
      if (toolCalls && toolCalls.length > 0) {
        for (let i = 0; i < toolCalls.length; i++) {
          const toolCall = toolCalls[i];
          const toolResult = toolResults?.[i];

          // Add tool call
          setMsgs((m) => [
            ...m,
            {
              role: "assistant",
              content: `🛠 Called ${toolCall.toolName}`,
              conversation,
              createdAt: new Date(),
              id: 1,
            },
          ]);

          // Add tool result if available
          if (toolResult) {
            setMsgs((m) => [
              ...m,
              {
                role: "assistant",
                content: JSON.stringify(toolResult),
                id: 1,
                conversation,
                createdAt: new Date(),
              },
            ]);
          }
        }
      }

      setThinking(false);
    },
    [msgs, setMsgs, settings, databases]
  );

  const stop = () => abortRef.current?.abort();

  return { msgs, send, stop, thinking };
}
