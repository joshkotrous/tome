import { useAppData } from "@/applicationDataProvider";
import { DatabaseSchema, TomeMessage } from "@/types";
import { streamResponse, TomeAgentModel } from "core/ai";
import React, { SetStateAction, useState } from "react";
import { getAgentTools } from "./tools";
import { EDITOR_AGENT_PROMPT } from "./prompts";
import { nanoid } from "nanoid";
import { useQueryData } from "@/queryDataProvider";
import { ToolInvocationUIPart } from "@ai-sdk/ui-utils";

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
  return updatedMessages;
}

interface UseAgentOptions {
  initialMessages: TomeMessage[];
  mode?: "editor" | "agent";
  model: TomeAgentModel;
  schema: DatabaseSchema;
  permissionNeeded?: boolean;
  setPermissionNeeded: React.Dispatch<SetStateAction<boolean>>;
  query: string;
  setQuery: React.Dispatch<SetStateAction<string>>;
  getSchemaFn: (connectionName: string, connectionId: number) => any;
  runQueryFn: (
    connectionName: string,
    connectionId: number,
    query: string
  ) => any;
}

export function useAgent({
  initialMessages,
  mode,
  model,
  setPermissionNeeded,
  query,
  schema,
  setQuery,
  getSchemaFn,
  runQueryFn,
}: UseAgentOptions) {
  const { settings } = useAppData();
  const { currentQuery, currentConnection } = useQueryData();
  const [messages, setMessages] = useState<TomeMessage[]>(initialMessages);
  const [thinking, setThinking] = useState(false);

  async function sendMessage(content: string) {
    setThinking(true);

    const tools = getAgentTools({
      getSchemaFn,
      query,
      setQuery,
      runQueryFn,
    });

    const newMessages: TomeMessage[] = [
      ...messages,
      {
        id: nanoid(4),
        content,
        conversation: null,
        parts: [],
        query: null,
        role: "user",
        createdAt: new Date(),
      },
    ];

    if (
      !settings?.aiFeatures.providers.anthropic.apiKey &&
      !settings?.aiFeatures.providers.openai.apiKey
    ) {
      return;
    }

    const systemPrompt =
      mode === "editor"
        ? EDITOR_AGENT_PROMPT.replace("{{CURRENT_QUERY}}", query)
            .replace(
              "{{CURRENT_CONNECTION}}",
              JSON.stringify(currentConnection)
            )
            .replace("{{FULL_SCHEMA}}", "")
        : EDITOR_AGENT_PROMPT.replace("{{CURRENT_QUERY}}", query)
            .replace(
              "{{CURRENT_CONNECTION}}",
              JSON.stringify(currentConnection)
            )
            .replace("{{FULL_SCHEMA}}", JSON.stringify(schema));

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
      toolChoice: "required",
      messages: newMessages,
      system: systemPrompt,
      onChunk: ({ chunk }) => {
        console.log(chunk);
        if (chunk.type === "text-delta") {
          setMessages((m) => {
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
                id: nanoid(4),
                role: "assistant" as const,
                content: textDelta,
                createdAt: new Date(),
                conversation: null,
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
                conversation: null,
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
          const { toolCallId, toolName } = chunk;
          if (toolName === "askForPermission") {
            setPermissionNeeded(true);
            return;
          }
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
                      state: "result",
                      result: "",
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
      onFinish: ({ text, toolCalls }) => {
        const calls: ToolInvocationUIPart[] = toolCalls.map((i) => ({
          type: "tool-invocation",
          toolInvocation: {
            state: "result",
            toolCallId: i.toolCallId,
            toolName: i.toolName,
            args: i.args,
            result: "",
          },
        }));
        if (currentQuery) {
          window.messages.createMessage({
            content: text,
            query: currentQuery?.id,
            role: "assistant",
            conversation: null,
            parts: calls,
          });
        }
      },
    });

    await streamResult.consumeStream();
  }

  return { messages, sendMessage, thinking };
}
