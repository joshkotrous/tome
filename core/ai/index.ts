import { Message, StreamTextResult, Tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { AIProvider } from "../../src/types";

export type ToolMap = Record<string, Tool<any, any>>;

export function streamResponse(opts: {
  prompt?: string;
  system?: string;
  tools?: ToolMap;
  apiKey: string;
  provider: AIProvider;
  messages?: Omit<Message, "id">[];
}): StreamTextResult<ToolMap, never> {
  const { prompt, tools = {} } = opts;

  switch (opts.provider) {
    case "Open AI":
      return streamOpenAI(
        opts.apiKey,
        tools,
        opts.system,
        opts.messages,
        prompt
      );
    case "Anthropic":
      return streamAnthropic(
        opts.apiKey,
        tools,
        opts.system,
        opts.messages,
        prompt
      );
    default:
      throw new Error(`Unsupported provider: ${opts.provider}`);
  }
}

function streamOpenAI(
  apiKey: string,
  tools: ToolMap,
  system?: string,
  messages?: Omit<Message, "id">[],
  prompt?: string
): StreamTextResult<ToolMap, never> {
  const openai = createOpenAI({ apiKey });

  return streamText({
    model: openai("gpt-4o"),
    prompt,
    system,
    tools,
    messages,
    maxSteps: 5,
  });
}

function streamAnthropic(
  apiKey: string,
  tools: ToolMap,
  system?: string,
  messages?: Omit<Message, "id">[],
  prompt?: string
): StreamTextResult<ToolMap, never> {
  const anthropic = createAnthropic({ apiKey });

  return streamText({
    model: anthropic("claude-3-sonnet-20240229"),
    prompt,
    system,
    tools,
    messages,
    maxSteps: 5,
  });
}
