import { useAppData } from "@/applicationDataProvider";
import {
  Connection,
  ConnectionSchema,
  Conversation,
  MessageMetadata,
  Query,
  TomeMessage,
} from "@/types";
import { streamResponse, TomeAgentModel } from "../../core/ai";
import React, { SetStateAction, useState, useEffect, useRef } from "react";
import { getAgentTools } from "./tools";
import { AGENT_MODE_PROMPT, EDITOR_AGENT_PROMPT } from "./prompts";
import { nanoid } from "nanoid";
import { useQueryData } from "@/queryDataProvider";

// Helper to extract metadata from tool results
function extractMetadataFromToolResult(
  toolName: string,
  args: any,
  result: any
): MessageMetadata | undefined {
  if (toolName === "runQuery" || toolName === "visualizeData") {
    try {
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      
      if (parsed.error) {
        return undefined;
      }

      // For visualizeData, extract from visualization object
      if (toolName === "visualizeData" && parsed.visualization) {
        return {
          queryResults: {
            query: args?.query || parsed.visualization.query,
            records: (parsed.visualization.data || []).slice(0, 5),
            totalCount: parsed.visualization.totalRows || 0,
            columns: parsed.visualization.data?.[0] ? Object.keys(parsed.visualization.data[0]) : [],
          },
          visualization: {
            chartType: parsed.visualization.config?.chartType,
            xAxis: parsed.visualization.config?.xAxis,
            yAxis: parsed.visualization.config?.yAxis,
            title: parsed.visualization.config?.title,
          },
        };
      }

      // For runQuery
      if (toolName === "runQuery") {
        const records = parsed.records ?? parsed.rows ?? [];
        return {
          queryResults: {
            query: args?.query || "",
            records: records.slice(0, 5),
            totalCount: parsed.totalCount ?? parsed.rowCount ?? records.length,
            columns: records.length > 0 ? Object.keys(records[0]) : [],
          },
        };
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  return undefined;
}

export function updateMessagesWithToolResult(
  messages: TomeMessage[],
  result: unknown,
  toolCallId?: string
): TomeMessage[] {
  if (messages.length === 0) return messages;

  // Copy the messages array and the last message
  const updatedMessages = [...messages];
  const lastMessage = { ...updatedMessages[updatedMessages.length - 1] };

  // If no toolCallId provided, find the first pending tool
  let targetToolCallId = toolCallId;
  if (!targetToolCallId) {
    // Look for first pending tool in parts
    const pendingPart = lastMessage.parts?.find(
      (part) =>
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "partial-call"
    );

    if (pendingPart?.type !== "tool-invocation") {
      return messages;
    }

    if (pendingPart) {
      targetToolCallId = pendingPart.toolInvocation.toolCallId;
    } else {
      // Look for first pending tool in toolInvocations
      const pendingInvocation = lastMessage.toolInvocations?.find(
        (toolInvocation) => toolInvocation.state === "partial-call"
      );
      if (pendingInvocation) {
        targetToolCallId = pendingInvocation.toolCallId;
      }
    }
  }

  // If still no target found, return unchanged
  if (!targetToolCallId) {
    console.warn("No pending tool invocation found to update");
    return messages;
  }

  // Copy parts and toolInvocations for immutability
  lastMessage.parts = lastMessage.parts?.map((part) =>
    part.type === "tool-invocation" &&
    part.toolInvocation.toolCallId === targetToolCallId
      ? {
          ...part,
          toolInvocation: {
            ...part.toolInvocation,
            state: "result",
            result,
          },
        }
      : part
  );

  lastMessage.toolInvocations = lastMessage.toolInvocations?.map(
    (toolInvocation) =>
      toolInvocation.toolCallId === targetToolCallId
        ? {
            ...toolInvocation,
            state: "result",
            result,
          }
        : toolInvocation
  );

  // Replace the last message in the array
  updatedMessages[updatedMessages.length - 1] = lastMessage;
  window.messages.updateMessage(lastMessage.id, lastMessage);
  return updatedMessages;
}

interface UseAgentOptions {
  initialMessages: TomeMessage[];
  mode?: "editor" | "agent";
  model: TomeAgentModel;
  schema?: ConnectionSchema;
  query?: string;
  setQuery?: React.Dispatch<SetStateAction<string>>;
  currentConnection?: Connection;
  currentQuery?: Query;
  selectedConversation?: Conversation | null;
}

export function useAgent({
  initialMessages,
  mode,
  model,
  query,
  schema,
  setQuery,
  currentConnection,
  currentQuery,
  selectedConversation,
}: UseAgentOptions) {
  const { settings } = useAppData();
  const { connect, connected, runQuery } = useQueryData();
  const { databases } = useAppData();
  const [messages, setMessages] = useState<TomeMessage[]>(initialMessages);
  const [thinking, setThinking] = useState(false);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  
  // Map to track toolCallId -> database message ID for updating
  const toolCallToDbIdRef = useRef<Map<string, string>>(new Map());

  // Update messages when initialMessages changes (e.g., when switching queries)
  useEffect(() => {
    setMessages(initialMessages);
    if (initialMessages.length > 0) {
      const lastMsg = initialMessages[initialMessages.length - 1];
      console.log("initial", lastMsg);
      if (
        lastMsg.parts.some(
          (i) =>
            i.type === "tool-invocation" &&
            i.toolInvocation.toolName === "askForPermission" &&
            i.toolInvocation.state === "partial-call"
        )
      ) {
        setPermissionNeeded(true);
      }
    }
  }, [initialMessages]);

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
    const schema = await window.connections.getConnectionSchema(conn.id);
    return schema;
  }

  async function executeQuery(
    connectionName: string,
    connectionId: number,
    query: string,
    maxRows: number = 5
  ) {
    const conn = await getConnection(connectionName, connectionId);
    const res = await runQuery(conn, query);
    return res && "error" in res
      ? res
      : { 
          totalCount: res?.rowCount, 
          records: res?.rows?.slice(0, maxRows) ?? [],
          columns: res?.columns ?? (res?.rows && res.rows.length > 0 ? Object.keys(res.rows[0]) : []),
        };
  }

  // Separate function for visualization with higher row limit
  async function executeQueryForVisualization(
    connectionName: string,
    connectionId: number,
    query: string
  ) {
    return executeQuery(connectionName, connectionId, query, 100);
  }

  async function sendMessage(content: string, conversation?: number) {
    setThinking(true);

    const newMessage: TomeMessage = {
      id: nanoid(4),
      content,
      conversation: selectedConversation?.id ?? conversation ?? null,
      parts: [{ type: "text", text: content }],
      query: currentQuery?.id ?? null,
      role: "user",
      createdAt: new Date(),
    };

    await window.messages.createMessage(newMessage);

    const newMessages: TomeMessage[] = permissionNeeded
      ? [
          ...updateMessagesWithToolResult(
            messages,
            "Approval cancelled. Moving on"
          ),
          newMessage,
        ]
      : [...messages, newMessage];

    setPermissionNeeded(false);

    setMessages(newMessages);

    await runAgentWithMessages(newMessages, conversation);
  }

  async function runAgentWithMessages(
    messagesToUse: TomeMessage[],
    conversation?: number
  ) {
    if (
      !settings?.aiFeatures.providers.anthropic.apiKey &&
      !settings?.aiFeatures.providers.openai.apiKey
    ) {
      return;
    }

    // Callback for visualization tool in editor mode - updates the editor query
    const handleVisualization = mode === "editor" && setQuery 
      ? (visualization: { query: string }) => {
          // Update the editor with the visualization query so user can see/modify it
          setQuery(visualization.query);
        }
      : undefined;

    const tools = getAgentTools({
      getSchemaFn: getFullSchema,
      query,
      setQuery,
      runQueryFn: executeQuery,
      runQueryForVisualizationFn: executeQueryForVisualization,
      onVisualize: handleVisualization,
    });

    const systemPrompt =
      mode === "editor"
        ? EDITOR_AGENT_PROMPT.replace("{{CURRENT_QUERY}}", query ?? "")
            .replace(
              "{{CURRENT_CONNECTION}}",
              JSON.stringify(currentConnection)
            )
            .replace("{{FULL_SCHEMA}}", JSON.stringify(schema))
        : AGENT_MODE_PROMPT.replace("{{DATABASES}}", JSON.stringify(databases));

    const streamResult = streamResponse({
      apiKey:
        model.provider === "Open AI"
          ? settings.aiFeatures.providers.openai.apiKey
          : settings.aiFeatures.providers.anthropic.apiKey,
      model: model.name,
      toolCallStreaming: true,
      provider: model.provider,
      tools,
      maxSteps: 10,
      messages: messagesToUse,
      system: systemPrompt,
      onStepFinish: ({ toolCalls, toolResults }) => {
        
        // Update messages with tool results and metadata
        if (toolResults && toolResults.length > 0) {
          toolResults.forEach((toolResult: any) => {
            const toolCall = toolCalls?.find((tc: any) => tc.toolCallId === toolResult.toolCallId);
            if (toolCall) {
              const metadata = extractMetadataFromToolResult(
                toolCall.toolName,
                toolCall.args,
                toolResult.result
              );
              
              // Update the parts to include the actual result
              const updatedParts = [
                {
                  type: "tool-invocation" as const,
                  toolInvocation: {
                    toolName: toolCall.toolName,
                    toolCallId: toolResult.toolCallId,
                    state: "result" as const,
                    result: toolResult.result,
                    args: toolCall.args,
                  },
                },
              ];
              
              // Function to persist to database
              const persistToDb = (dbMessageId: string) => {
                window.messages.updateMessage(dbMessageId, {
                  parts: updatedParts,
                  metadata: metadata,
                });
              };
              
              // Get the database message ID from our map
              const dbMessageId = toolCallToDbIdRef.current.get(toolResult.toolCallId);
              
              if (dbMessageId) {
                persistToDb(dbMessageId);
              } else {
                // If not in map yet, wait a bit and retry (race condition handling)
                const checkAndUpdate = () => {
                  const id = toolCallToDbIdRef.current.get(toolResult.toolCallId);
                  if (id) {
                    persistToDb(id);
                  } else {
                    // Retry after a short delay
                    setTimeout(checkAndUpdate, 100);
                  }
                };
                setTimeout(checkAndUpdate, 50);
              }
              
              // Update the message in state
              setMessages((prevMsgs) => {
                const msgIndex = prevMsgs.findIndex((msg) =>
                  msg.parts?.some(
                    (part) =>
                      part.type === "tool-invocation" &&
                      part.toolInvocation.toolCallId === toolResult.toolCallId
                  )
                );
                
                if (msgIndex !== -1) {
                  const msg = prevMsgs[msgIndex];
                  
                  const updatedMsg: TomeMessage = {
                    ...msg,
                    parts: updatedParts,
                    metadata: metadata || msg.metadata,
                  };
                  
                  return [
                    ...prevMsgs.slice(0, msgIndex),
                    updatedMsg,
                    ...prevMsgs.slice(msgIndex + 1),
                  ];
                }
                return prevMsgs;
              });
            }
          });
        }
      },
      onChunk: ({ chunk }) => {
        if (chunk.type === "text-delta") {
          setMessages((m) => {
            const { textDelta } = chunk;
            const last = m[m.length - 1];
            // Check if we should append to existing assistant message
            if (last?.role === "assistant") {
              return [
                ...m.slice(0, -1),
                { ...last, content: last.content + textDelta },
              ];
            }
            return [
              ...m,
              {
                id: nanoid(4),
                role: "assistant" as const,
                content: textDelta,
                createdAt: new Date(),
                conversation: selectedConversation?.id ?? conversation ?? null,
                query: currentQuery?.id ?? null,
                parts: [],
              },
            ];
          });
        }

        if (chunk.type === "tool-call-streaming-start") {
          const { toolName } = chunk;

          if (toolName === "askForPermission") {
            setPermissionNeeded(true);
          }
          setMessages((m) => {
            const { toolName, toolCallId } = chunk;
            return [
              ...m,
              {
                id: nanoid(4),
                role: "assistant",
                content: "",
                createdAt: new Date(),
                conversation: selectedConversation?.id ?? conversation ?? null,
                query: currentQuery?.id ?? null,
                parts: [
                  {
                    type: "tool-invocation",
                    toolInvocation: {
                      toolCallId,
                      toolName,
                      state: "partial-call",
                      args: [],
                    },
                  },
                ],
              },
            ];
          });
        }

        if (chunk.type === "tool-call") {
          const { toolCallId, toolName, args } = chunk;
          const askForPermissionTool = toolName === "askForPermission";
          if (askForPermissionTool) {
            setPermissionNeeded(true);
          }
          
          // Create message in database and store the mapping
          window.messages.createMessage({
            content: "",
            conversation: selectedConversation?.id ?? conversation ?? null,
            query: currentQuery?.id ?? null,
            parts: [
              {
                type: "tool-invocation",
                toolInvocation: {
                  toolName,
                  toolCallId,
                  state: askForPermissionTool ? "partial-call" : "result",
                  result: "",
                  args,
                },
              },
            ],
            role: "assistant",
          }).then((createdMessage: TomeMessage) => {
            // Store the mapping so we can update the correct message later
            toolCallToDbIdRef.current.set(toolCallId, createdMessage.id);
            
            // Also update the state message with the database ID
            setMessages((prevMsgs) => {
              const toolMsgIndex = prevMsgs.findIndex((msg) =>
                msg.parts?.find(
                  (part) =>
                    part.type === "tool-invocation" &&
                    part.toolInvocation.toolCallId === toolCallId
                )
              );

              if (toolMsgIndex !== -1) {
                const toolMsg = prevMsgs[toolMsgIndex];
                return [
                  ...prevMsgs.slice(0, toolMsgIndex),
                  { ...toolMsg, id: createdMessage.id },
                  ...prevMsgs.slice(toolMsgIndex + 1),
                ];
              }
              return prevMsgs;
            });
          });
          
          setMessages((prevMsgs) => {
            const toolMsgIndex = prevMsgs.findIndex((msg) =>
              msg.parts?.find(
                (part) =>
                  part.type === "tool-invocation" &&
                  part.toolInvocation.state === "partial-call" &&
                  part.toolInvocation.toolCallId === toolCallId
              )
            );

            if (toolMsgIndex === -1) {
              console.warn(`Tool message with ID ${toolCallId} not found`);
              return prevMsgs;
            }

            const toolMsg = prevMsgs[toolMsgIndex];
            const updatedMsg: TomeMessage = {
              ...toolMsg,
              parts: toolMsg.parts?.map((part) => {
                if (
                  part.type === "tool-invocation" &&
                  part.toolInvocation.toolCallId === toolCallId
                ) {
                  return {
                    ...part,
                    toolInvocation: {
                      ...part.toolInvocation,
                      state: askForPermissionTool ? "partial-call" : "result",
                      result: "",
                      args,
                    },
                  };
                }
                return part;
              }),
            };

            return prevMsgs.map((msg, index) =>
              index === toolMsgIndex ? updatedMsg : msg
            );
          });
        }
      },
      onFinish: ({ text }) => {
        console.log(text);
        if (text) {
          window.messages.createMessage({
            content: text,
            query: currentQuery?.id ?? null,
            role: "assistant",
            conversation: selectedConversation?.id ?? conversation ?? null,
            parts: [{ type: "text", text }],
          });
        }
      },
    });

    await streamResult
      .consumeStream()
      .catch()
      .finally(() => setThinking(false));
  }

  async function approveQuery() {
    // Update messages with approval result
    const updatedMessages = updateMessagesWithToolResult(
      messages,
      { approved: true },
      undefined // Will find the first pending tool
    );

    // Update the messages state
    setMessages(updatedMessages);

    // Reset permission needed flag
    setPermissionNeeded(false);

    // Refresh the response with updated messages
    await runAgentWithMessages(updatedMessages);
  }

  async function refreshResponse() {
    // Run the agent again with current messages
    await runAgentWithMessages(messages);
  }

  return {
    messages,
    sendMessage,
    thinking,
    approveQuery,
    refreshResponse,
    permissionNeeded,
    setPermissionNeeded,
  };
}
