// useAgent.ts --------------------------------------------------------------
import { useRef, useState, useCallback, Dispatch, SetStateAction } from "react";
import { tool } from "ai";
import { useDB } from "./databaseConnectionProvider";
import { streamResponse, TomeAgentModel, ToolMap } from "../core/ai";
import { z } from "zod";
import { useAppData } from "./applicationDataProvider";
import { useQueryData } from "./queryDataProvider";
import { nanoid } from "nanoid";
import { ConversationMessage, Database } from "./types";

interface UseAgentOptions {
  messages?: ConversationMessage[];
  setMessages?: Dispatch<SetStateAction<ConversationMessage[]>>;
}

/* -------------------------------------------------------------------------- */
/*                              Security helpers                              */
/* -------------------------------------------------------------------------- */

// Safety budget – limits the size of the result set returned from the DB
const MAX_RESULT_ROWS = 100;

// Only these SQL commands are considered safe. They must be the very first
// keyword of the (single-statement) query.
const SAFE_COMMANDS = [
  "SELECT",
  "WITH",
  "EXPLAIN",
  "SHOW",
  "DESCRIBE",
] as const;

/**
 * Check whether a DB connection is already established by the user and is
 * therefore safe for the AI agent to use. The agent is NOT allowed to
 * establish new connections on its own.
 */
function isConnectionAgentAccessible(
  connectedDbs: ReturnType<typeof useDB>["connected"],
  connectionId: number,
  connectionName: string
) {
  return connectedDbs.some(
    (d) => d.id === connectionId && d.name === connectionName
  );
}

/** Remove comments & compress whitespace */
function normaliseQuery(q: string) {
  return (
    q
      .replace(/\/\*[\s\S]*?\*\//g, " ") // multi-line comments
      .replace(/--.*$/gm, " ") // single-line comments
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Validate a query to ensure it is strictly read-only and bound by size.
 * Throws an Error if any rule is violated.
 */
function sanitiseAndValidateQuery(original: string): string {
  const stripped = normaliseQuery(original);

  // Reject multi-statement queries (very naïve but practical)
  const segments = stripped.split(/;/).filter(Boolean);
  if (segments.length !== 1) {
    throw new Error(
      "Only single-statement, read-only queries are permitted for the AI agent."
    );
  }

  const stmt = segments[0];
  const firstKeyword = (stmt.match(/^(\w+)/i)?.[1] ?? "").toUpperCase();
  if (!SAFE_COMMANDS.includes(firstKeyword as typeof SAFE_COMMANDS[number])) {
    throw new Error(
      `Command '${firstKeyword}' is not allowed – agent is restricted to read-only queries.`
    );
  }

  // Black-list obvious mutating / side-effect keywords & functions
  const UNSAFE_PATTERN = /\b(ALTER|CREATE|DELETE|DROP|GRANT|INSERT|MERGE|REINDEX|REPLACE|TRUNCATE|UPDATE|VACUUM|REFRESH|ANALYZE|CALL|EXECUTE|INTO|FOR\s+UPDATE|COPY|LOCK|SET|COMMENT|CLUSTER)\b/i;
  if (UNSAFE_PATTERN.test(stmt)) {
    throw new Error("Detected destructive or side-effect SQL – rejected.");
  }

  // Limit bypass: normalise/patch LIMIT clause to MAX_RESULT_ROWS
  let patchedStmt = stmt;
  const limitMatch = stmt.match(/\bLIMIT\s+(\d+)/i);
  if (limitMatch) {
    const value = parseInt(limitMatch[1], 10);
    if (isNaN(value) || value > MAX_RESULT_ROWS) {
      patchedStmt = stmt.replace(/\bLIMIT\s+\d+/i, `LIMIT ${MAX_RESULT_ROWS}`);
    }
  } else if (firstKeyword === "SELECT" || firstKeyword === "WITH") {
    // Append LIMIT if missing for large SELECTs/CTEs
    patchedStmt = `${stmt} LIMIT ${MAX_RESULT_ROWS}`;
  }

  return patchedStmt;
}

/* -------------------------------------------------------------------------- */

export function useAgent(options: UseAgentOptions = {}) {
  const { connect, connected } = useDB();
  const { runQuery } = useQueryData();
  const { settings, databases } = useAppData();

  // External / internal state handling
  const [internalMsgs, setInternalMsgs] = useState<ConversationMessage[]>([]);
  const msgs = options.messages ?? internalMsgs;
  const setMsgs = options.setMessages ?? setInternalMsgs;

  const [thinking, setThinking] = useState(false);
  const abortRef = useRef<AbortController>();

  async function getConnection(connectionName: string, connectionId: number) {
    // Authorisation: only already-connected DBs are available to the agent
    if (!isConnectionAgentAccessible(connected, connectionId, connectionName)) {
      throw new Error("Database connection is not authorised for AI agent use.");
    }

    const conn = connected.find(
      (i) => i.name === connectionName && i.id === connectionId
    );

    if (!conn) {
      throw new Error(
        `AI agent attempted to access a non-connected database (${connectionName}).`
      );
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
    // Validate query earlier to fail fast
    const safeQuery = sanitiseAndValidateQuery(query);

    const conn = await getConnection(connectionName, connectionId);

    const res = await runQuery({
      id: nanoid(4),
      connection: conn,
      query: safeQuery,
    });

    // Defensive slice – limits output regardless of LIMIT clause manipulation
    return res && "error" in res
      ? res
      : {
          totalCount: res?.rowCount,
          records: (res?.rows ?? []).slice(0, 5),
        };
  }

  const tools: ToolMap = {
    runQuery: tool({
      description:
        `Run a strictly read-only SQL query (SELECT/EXPLAIN/WITH/SHOW) on an already-connected database. Destructive commands are blocked and a LIMIT ${MAX_RESULT_ROWS} is enforced.`,
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
        "Return the full schema for an authorised connection so the agent can craft correct read-only queries.",
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

      const systemPrompt = `You are an AI assistant embedded in a database client UI. Your role is to help the user with any request, using the available tools and *already connected* database connections listed below:
      <databases>
      ${JSON.stringify(connected, null, 2)}
      </databases>
      
      **Behavior Guidelines:**
      - Use only the connections provided; you cannot create or open new ones.
      - Only read-only queries (SELECT/EXPLAIN/WITH/SHOW) are allowed; the tool will reject anything else.
      - The tool enforces LIMIT ${MAX_RESULT_ROWS} and returns a maximum of 5 preview rows.
      - When returning query results, always:
        - Show them in **table format**
        - Include the **final query used**
      - Always end each response with a UI action tag: \`<ui_action>{action}</ui_action>\`.
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

      // Tool calls / results logging
      const toolCalls = await finalResult.toolCalls;
      const toolResults = await finalResult.toolResults;
      if (toolCalls && toolCalls.length > 0) {
        for (let i = 0; i < toolCalls.length; i++) {
          const toolCall = toolCalls[i];
          const toolResult = toolResults?.[i];

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
    [msgs, setMsgs, settings, connected]
  );

  const stop = () => abortRef.current?.abort();

  return { msgs, send, stop, thinking };
}
