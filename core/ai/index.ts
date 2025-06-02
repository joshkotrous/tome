import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { getSettings } from "../settings";
import { Settings } from "../../src/types";

export async function streamResponse() {
  const settings = await getSettings();
  if (!settings.aiFeatures.enabled || !settings.aiFeatures.apiKey) {
    throw new Error("AI features are disabled or no key is configured");
  }
  switch (settings.aiFeatures.provider) {
    case "Anthropic":
      return streamAnthropic(settings);
    case "Open AI":
      return streamOpenAi(settings);
  }
}

function streamAnthropic(settings: Settings) {
  const myAnthropic = createAnthropic({
    apiKey: settings.aiFeatures.apiKey,
  });

  return streamText({
    model: myAnthropic(""),
    prompt: "Write a poem about embedding models.",
  });
}

function streamOpenAi(settings: Settings) {
  const myOpenAI = createOpenAI({ apiKey: settings.aiFeatures.apiKey });

  return streamText({
    model: myOpenAI("gpt-4-turbo"),
    prompt: "Write a poem about embedding models.",
  });
}
