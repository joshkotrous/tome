// useAgent.ts --------------------------------------------------------------
import { useRef, useState, useCallback } from "react";
import { tool } from "ai";
import { useDB } from "./databaseConnectionProvider";
import { streamResponse, ToolMap } from "../core/ai";
import { z } from "zod";
import { useAppData } from "./applicationDataProvider";
import { useQueryData } from "./queryDataProvider";
import { nanoid } from "nanoid";

function isQueryAllowed(sql: string): boolean {
  /**
   * Only allow read-only/stateless queries, e.g. SELECT (and optionally EXPLAIN, WITH).
   * Block any mutative/destructive SQL statements.
   *
   * Covers attempts with leading whitespace and SQL comments.
   */
  // Remove leading whitespace and SQL comments (single/multiline)
  let stripped = sql.trim();

  // Remove leading /* ... */ block comments
  while (stripped.startsWith("/*")) {
    const endIdx = stripped.indexOf("*/");
    if (endIdx === -1) break;
    stripped = stripped.slice(endIdx + 2).trim();
  }
  // Remove leading -- ... comments
  while (stripped.startsWith("--")) {
    const endIdx = stripped.indexOf("\n");
    if (endIdx === -1) return false; // Only comment, no real statement
    stripped = stripped.slice(endIdx + 1).trim();
  }

  // Extract first word/keyword (case-insensitive)
  // Also allow "WITH", "EXPLAIN", "SELECT"
  const firstTokenMatch = stripped.match(/^(\w+)/i);
  if (!firstTokenMatch) {
    return false;
  }
  const firstToken = firstTokenMatch[1].toUpperCase();

  // Allow only certain safe SQL commands at the top level:
  // SELECT, WITH, EXPLAIN (for read queries)
  // You can expand this list as necessary.
  const ALLOWED_SQL_COMMANDS = ["SELECT", "WITH", "EXPLAIN"];

  return ALLOWED_SQL_COMMANDS.includes(firstToken);
}

export function useAgent() {
  const { connect, connected } = useDB();
  const { runQuery } = useQueryData();
  const { settings, databases } = useAppData();
  const [msgs, setMsgs] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
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
    if (!isQueryAllowed(query)) {
      throw new Error(
        "Query type not permitted. Only safe, read-only SQL statements (SELECT, WITH, EXPLAIN) are allowed."
      );
    }
    const conn = await getConnection(connectionName, connectionId);
    const res = await runQuery({ id: nanoid(4), connection: conn, query });
    return res;
  }

  const tools: ToolMap = {
    runQuery: tool({
      description:
        "Run a SQL query and return JSON rows. Select the most likely relevant connection from <databases> that should be used in the query",
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
    async (text: string) => {
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

      const updatedMessages = [
        ...msgs,
        { role: "user" as "user" | "assistant", content: text },
      ];

      setMsgs(updatedMessages);
      setThinking(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const systemPrompt = `You are a helpful assistant embedded within a database client user interface. You are to help the user facilitate any request they may have and use the tools at your disposal to achieve that. Below are a list of available database connections you can use:
      <databases>
      ${JSON.stringify(databases, null, 2)}
      </databases>

      When using tools and a connectionName and connectionId are required, these should be retrieved from the <databases> list. When displaying query results, always default to a table format. When outputting results also include the query you used to show those. If there are multiple databases, you should ask the user which one to use if they dont already specify. Dont output the fully query output in your response, only a summary of a few records. When a user asks you to write a query, default to executing it unless it is mutable or destructive. Always output any queries you ran. End every response with <ui_action>.
      
      UI Action instructions:
      If you need permission to run a query, output 'approve-query' within <ui_action>. Do not include quotes.
      `;
      // Use textStream and handle tools through the result
      const streamResult = streamResponse({
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
            // Create a new array with updated last message (immutable update)
            return [
              ...m.slice(0, -1),
              { ...last, content: last.content + textPart },
            ];
          }
          return [...m, { role: "assistant", content: textPart }];
        });
      }

      // Get the final result to access tool calls and results
      const finalResult = await streamResult;

      // Get tool calls and results (they are promises)
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
            },
          ]);

          // Add tool result if available
          if (toolResult) {
            setMsgs((m) => [
              ...m,
              {
                role: "assistant",
                content: JSON.stringify(toolResult),
              },
            ]);
          }
        }
      }
      setThinking(false);
    },
    [msgs, settings, databases]
  );

  const stop = () => abortRef.current?.abort();

  return { msgs, send, stop, thinking };
}