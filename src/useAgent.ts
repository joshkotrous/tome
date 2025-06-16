// useAgent.ts --------------------------------------------------------------
import { useRef, useState, useCallback, Dispatch, SetStateAction } from "react";
import { tool } from "ai";
import { streamResponse, TomeAgentModel, ToolMap } from "../core/ai";
import { z } from "zod";
import { useAppData } from "./applicationDataProvider";
import { useQueryData } from "./queryDataProvider";
import { ConversationMessage } from "./types";

interface UseAgentOptions {
  messages?: ConversationMessage[];
  setMessages?: Dispatch<SetStateAction<ConversationMessage[]>>;
}

export function useAgent(options: UseAgentOptions = {}) {
  const { connect, connected } = useQueryData();
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
    const conn = await getConnection(connectionName, connectionId);
    const res = await runQuery(conn, query);
    return res && "error" in res
      ? res
      : { totalCount: res?.rowCount, records: res?.rows.splice(0, 5) ?? [] };
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
          toolCallId: null,
          toolCallStatus: null,
          query: null,
        },
      ];
      setMsgs(updatedMessages);

      if (conversation) {
        window.messages.createMessage({
          content: text,
          role: "user",
          conversation,
          query: null,
          toolCallId: null,
          toolCallStatus: null,
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
        model: model.name,
        tools,
        messages: updatedMessages
          .filter((i) => i.role !== "tool-call")
          .map((k) => ({
            ...k,
            role: k.role as "user" | "assistant",
          })),
        system: systemPrompt,
        apiKey: settings.aiFeatures.apiKey,
        provider: settings.aiFeatures.provider,
        toolCallStreaming: true,
        onChunk: ({ chunk }) => {
          console.log(chunk);
          if (chunk.type === "text-delta") {
            setMsgs((m) => {
              const { textDelta } = chunk;
              const last = m[m.length - 1];
              // Check if we should append to existing assistant message
              if (last?.role === "assistant" && !(last as any).toolTag) {
                return [
                  ...m.slice(0, -1),
                  { ...last, content: last.content + textDelta },
                ];
              }
              return [
                ...m,
                {
                  id: Date.now(),
                  role: "assistant",
                  content: textDelta,
                  createdAt: new Date(),
                  conversation,
                  query: null,
                  toolCallId: null,
                  toolCallStatus: null,
                },
              ];
            });
          }

          if (chunk.type === "tool-call-streaming-start") {
            setMsgs((m) => {
              const { toolName, toolCallId } = chunk;
              return [
                ...m,
                {
                  id: Date.now(),
                  role: "tool-call",
                  content: toolName,
                  toolCallId,
                  toolCallStatus: "pending",
                  createdAt: new Date(),
                  conversation,
                  query: null,
                },
              ];
            });
          }

          if (chunk.type === "tool-call") {
            const { toolCallId } = chunk;

            setMsgs((prevMsgs) => {
              const toolMsg = prevMsgs.find((i) => i.toolCallId === toolCallId);

              if (!toolMsg) {
                console.warn(`Tool message with ID ${toolCallId} not found`);
                return prevMsgs;
              }

              const updatedMsg: ConversationMessage = {
                ...toolMsg,
                toolCallStatus: "complete",
              };

              return prevMsgs.map((msg) =>
                msg.toolCallId === toolCallId ? updatedMsg : msg
              );
            });
          }
        },
        onFinish: ({ text }) => {
          if (conversation) {
            window.messages.createMessage({
              content: text,
              role: "assistant",
              conversation,
              query: null,
              toolCallId: null,
              toolCallStatus: null,
            });
          }
        },
      });
      await streamResult.consumeStream();
      setThinking(false);
    },
    [msgs, setMsgs, settings, databases]
  );

  const stop = () => abortRef.current?.abort();

  return { msgs, send, stop, thinking };
}
