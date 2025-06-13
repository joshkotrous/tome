import {
  generateText,
  Message,
  StreamTextResult,
  Tool,
  GenerateTextResult,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { AIProvider } from "../../src/types";
import z from "zod";

export const TomeOAIAgentModelObject = z.enum([
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-4.5",
  "gpt-4.1",
  "o3",
  "o4",
]);

export type TomeOAIAgentModel = z.infer<typeof TomeOAIAgentModelObject>;

export const TomeAnthropicAgentModelObject = z.enum([
  "claude-opus-4",
  "claude-sonnet-4",
  "claude-sonnet-3.7",
  "claude-sonnet-3.5",
]);

export type TomeAnthropicAgentModel = z.infer<
  typeof TomeAnthropicAgentModelObject
>;

export type TomeAgentModel = TomeAnthropicAgentModel | TomeOAIAgentModel;

export type ToolMap = Record<string, Tool<any, any>>;

export interface StreamResponseOptions {
  prompt?: string;
  system?: string;
  tools?: ToolMap;
  apiKey: string;
  provider: AIProvider;
  model: TomeAgentModel;
  messages?: Omit<Message, "id">[];
  maxSteps?: number;
}

export function streamResponse(
  opts: StreamResponseOptions
): StreamTextResult<ToolMap, never> {
  const { prompt, tools = {} } = opts;
  switch (opts.provider) {
    case "Open AI":
      return streamOpenAI(
        opts.apiKey,
        tools,
        opts.system,
        opts.messages,
        prompt,
        opts.model as TomeOAIAgentModel,
        opts.maxSteps
      );
    case "Anthropic":
      return streamAnthropic(
        opts.apiKey,
        tools,
        opts.system,
        opts.messages,
        prompt,
        opts.model as TomeAnthropicAgentModel,
        opts.maxSteps
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
  prompt?: string,
  model: TomeOAIAgentModel = "gpt-4o",
  maxSteps = 10
): StreamTextResult<ToolMap, never> {
  const openai = createOpenAI({ apiKey });
  return streamText({
    model: openai(model),
    prompt,
    system,
    tools,
    messages,
    maxSteps,
  });
}

function streamAnthropic(
  apiKey: string,
  tools: ToolMap,
  system?: string,
  messages?: Omit<Message, "id">[],
  prompt?: string,
  model: TomeAnthropicAgentModel = "claude-sonnet-4",
  maxSteps = 10
): StreamTextResult<ToolMap, never> {
  function getAnthropicModel(model: TomeAnthropicAgentModel) {
    switch (model) {
      case "claude-sonnet-4":
        return "claude-4-sonnet-20250514";
      case "claude-opus-4":
        return "claude-4-opus-20250514";
      case "claude-sonnet-3.7":
        return "claude-3-7-sonnet-20250219";
      case "claude-sonnet-3.5":
        return "claude-3-5-sonnet-latest";
    }
  }

  const mappedModel = getAnthropicModel(model);
  const anthropic = createAnthropic({ apiKey });
  return streamText({
    model: anthropic(mappedModel),
    prompt,
    system,
    tools,
    messages,
    maxSteps,
  });
}

export async function getResponse(opts: {
  prompt?: string;
  system?: string;
  tools?: ToolMap;
  apiKey: string;
  provider: AIProvider;
  messages?: Omit<Message, "id">[];
}): Promise<GenerateTextResult<ToolMap, never>> {
  const { prompt, tools = {} } = opts;
  switch (opts.provider) {
    case "Open AI":
      return await generateOpenAI(
        opts.apiKey,
        tools,
        opts.system,
        opts.messages,
        prompt
      );
    case "Anthropic":
      return await generateAnthropic(
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

async function generateOpenAI(
  apiKey: string,
  tools: ToolMap,
  system?: string,
  messages?: Omit<Message, "id">[],
  prompt?: string,
  maxSteps = 5
): Promise<GenerateTextResult<ToolMap, never>> {
  const openai = createOpenAI({ apiKey });
  return await generateText({
    model: openai("gpt-4o-mini"),
    prompt,
    system,
    tools,
    messages,
    maxSteps,
  });
}

async function generateAnthropic(
  apiKey: string,
  tools: ToolMap,
  system?: string,
  messages?: Omit<Message, "id">[],
  prompt?: string,
  maxSteps = 5
): Promise<GenerateTextResult<ToolMap, never>> {
  const anthropic = createAnthropic({ apiKey });
  return await generateText({
    model: anthropic("claude-3-sonnet-20240229"),
    prompt,
    system,
    tools,
    messages,
    maxSteps,
  });
}
