import {
  generateText,
  Message,
  StreamTextResult,
  Tool,
  GenerateTextResult,
  StreamTextOnChunkCallback,
  StreamTextOnFinishCallback,
  ToolChoice,
  StreamTextOnStepFinishCallback,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { AIProvider } from "../../src/types";
import { createMainProcessAIProxy } from "./proxy";
import z from "zod";

/**
 * Detect if we're running in the main process (Node.js) or renderer process (browser).
 * Returns the appropriate fetch proxy based on the environment.
 */
function getProxyFetch(): typeof fetch {
  // Check if we're in a browser/renderer environment with IPC proxy available
  const isRenderer = typeof window !== "undefined" && window.proxy?.fetchStream;
  
  if (isRenderer) {
    // Create IPC-based proxy inline for renderer process (avoids CORS)
    return createRendererProxy();
  }
  
  // Use direct fetch for main process
  return createMainProcessAIProxy();
}

/**
 * Creates a fetch proxy for the renderer process that routes through IPC
 * to avoid CORS restrictions.
 */
function createRendererProxy(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlString: string;
    let method: string = "GET";
    let headers: Record<string, string> = {};
    let body: string | undefined;

    if (input instanceof Request) {
      const clonedRequest = input.clone();
      urlString = clonedRequest.url;
      method = clonedRequest.method;
      clonedRequest.headers.forEach((value, key) => {
        headers[key] = value;
      });
      try {
        body = await clonedRequest.text();
      } catch {
        // Body might already be consumed
      }
    } else {
      urlString = input.toString();
    }

    if (init?.method) method = init.method;
    if (init?.headers) {
      const initHeaders = init.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : Object.entries(init.headers as Record<string, string>).reduce((acc, [key, value]) => {
            acc[key] = Array.isArray(value) ? value.join(", ") : String(value);
            return acc;
          }, {} as Record<string, string>);
      headers = { ...headers, ...initHeaders };
    }
    if (init?.body !== undefined) {
      body = typeof init.body === "string" ? init.body : String(init.body);
    }

    const needsProxy = urlString.includes("api.anthropic.com") || urlString.includes("api.openai.com");
    if (!needsProxy) {
      return fetch(input, init);
    }

    const result = await window.proxy.fetchStream(urlString, { method, headers, body });

    if (!result.ok) {
      throw new Error(`HTTP ${result.status}: ${(result as any).error || result.statusText || "Unknown error"}`);
    }

    if (!result.streamId) {
      throw new Error("No stream ID returned from proxy");
    }

    const streamId = result.streamId;
    const channel = `ai-stream-${streamId}`;
    
    const stream = new ReadableStream({
      start(controller) {
        const listener = (_event: unknown, data: { chunk?: string; done: boolean; error?: string }) => {
          if (data.error) {
            controller.error(new Error(data.error));
            window.ipcRenderer.off(channel, listener);
            return;
          }
          if (data.done) {
            controller.close();
            window.ipcRenderer.off(channel, listener);
            return;
          }
          if (data.chunk) {
            controller.enqueue(new TextEncoder().encode(data.chunk));
          }
        };
        window.ipcRenderer.on(channel, listener);
      },
    });

    return new Response(stream, {
      status: result.status,
      headers: new Headers(result.headers || {}),
    });
  };
}

export const TomeOAIAgentModelObject = z.enum([
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-4.5",
  "gpt-4.1",
  "o3",
  "o3-mini",
  "o4",
]);

export const TomeAnthropicAgentModelObject = z.enum([
  "claude-opus-4",
  "claude-sonnet-4",
  "claude-sonnet-3.7",
  "claude-sonnet-3.5",
]);

const ModelObject = z.object({
  provider: z.enum(["Open AI", "Anthropic"]),
  name: z.union([TomeOAIAgentModelObject, TomeAnthropicAgentModelObject]),
});

export const TomeAgentModels: z.infer<typeof ModelObject>[] = [
  // Anthropic Models
  {
    name: "claude-opus-4",
    provider: "Anthropic",
  },
  {
    name: "claude-sonnet-4",
    provider: "Anthropic",
  },
  {
    name: "claude-sonnet-3.7",
    provider: "Anthropic",
  },
  {
    name: "claude-sonnet-3.5",
    provider: "Anthropic",
  },

  // OpenAI Models
  {
    name: "gpt-4o",
    provider: "Open AI",
  },
  {
    name: "gpt-4-turbo",
    provider: "Open AI",
  },
  {
    name: "gpt-4",
    provider: "Open AI",
  },
  {
    name: "gpt-4.5",
    provider: "Open AI",
  },
  {
    name: "gpt-4.1",
    provider: "Open AI",
  },
  {
    name: "o3",
    provider: "Open AI",
  },
  {
    name: "o3-mini",
    provider: "Open AI",
  },
  {
    name: "o4",
    provider: "Open AI",
  },
];

export type TomeOAIAgentModel = z.infer<typeof TomeOAIAgentModelObject>;
export type TomeAnthropicAgentModel = z.infer<
  typeof TomeAnthropicAgentModelObject
>;

export type TomeAgentModelOption = TomeOAIAgentModel | TomeAnthropicAgentModel;

export type TomeAgentModel = z.infer<typeof ModelObject>;

export type ToolMap = Record<string, Tool<any, any>>;

export interface StreamResponseOptions {
  toolCallStreaming?: boolean;
  prompt?: string;
  system?: string;
  tools?: ToolMap;
  apiKey: string;
  provider: AIProvider;
  model: TomeAgentModelOption;
  messages?: Omit<Message, "id">[];
  maxSteps?: number;
  onChunk?: StreamTextOnChunkCallback<ToolMap>;
  onFinish?: StreamTextOnFinishCallback<ToolMap>;
  toolChoice?: ToolChoice<ToolMap>;
  onStepFinish?: StreamTextOnStepFinishCallback<ToolMap>;
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
        opts.maxSteps,
        opts.toolCallStreaming,
        opts.onChunk,
        opts.onFinish,
        opts.toolChoice,
        opts.onStepFinish
      );
    case "Anthropic":
      return streamAnthropic(
        opts.apiKey,
        tools,
        opts.system,
        opts.messages,
        prompt,
        opts.model as TomeAnthropicAgentModel,
        opts.maxSteps,
        opts.toolCallStreaming,
        opts.onChunk,
        opts.onFinish,
        opts.toolChoice,
        opts.onStepFinish
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
  maxSteps = 10,
  toolCallStreaming?: boolean,
  onChunk?: StreamTextOnChunkCallback<ToolMap>,
  onFinish?: StreamTextOnFinishCallback<ToolMap>,
  toolChoice?: ToolChoice<ToolMap>,
  onStepFinish?: StreamTextOnStepFinishCallback<ToolMap>
): StreamTextResult<ToolMap, never> {
  const proxyFetch = getProxyFetch();
  const openai = createOpenAI({ apiKey, fetch: proxyFetch });
  return streamText({
    model: openai(model),
    prompt,
    system,
    tools,
    messages,
    maxSteps,
    toolCallStreaming,
    onChunk,
    onFinish,
    toolChoice,
    onStepFinish,
  });
}

function streamAnthropic(
  apiKey: string,
  tools: ToolMap,
  system?: string,
  messages?: Omit<Message, "id">[],
  prompt?: string,
  model: TomeAnthropicAgentModel = "claude-sonnet-4",
  maxSteps = 10,
  toolCallStreaming?: boolean,
  onChunk?: StreamTextOnChunkCallback<ToolMap>,
  onFinish?: StreamTextOnFinishCallback<ToolMap>,
  toolChoice?: ToolChoice<ToolMap>,
  onStepFinish?: StreamTextOnStepFinishCallback<ToolMap>
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
  const proxyFetch = getProxyFetch();
  const anthropic = createAnthropic({ apiKey, fetch: proxyFetch });
  return streamText({
    model: anthropic(mappedModel),
    prompt,
    system,
    tools,
    messages,
    maxSteps,
    toolCallStreaming,
    onChunk,
    onFinish,
    toolChoice,
    onStepFinish,
  });
}

export async function getResponse(opts: {
  prompt?: string;
  system?: string;
  tools?: ToolMap;
  apiKey: string;
  provider: AIProvider;
  messages?: Omit<Message, "id">[];
  onStepFinish?: StreamTextOnStepFinishCallback<ToolMap>;
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
  const proxyFetch = getProxyFetch();
  const openai = createOpenAI({ apiKey, fetch: proxyFetch });
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
  const proxyFetch = getProxyFetch();
  const anthropic = createAnthropic({ apiKey, fetch: proxyFetch });
  return await generateText({
    model: anthropic("claude-haiku-4-5"),
    prompt,
    system,
    tools,
    messages,
    maxSteps,
  });
}
