import { streamText, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export interface AIConfig {
  apiKey: string;
  model?: string;
}

export function createAIProvider(config: AIConfig) {
  const openai = createOpenAI({
    apiKey: config.apiKey,
  });

  const model = config.model ?? "gpt-4o-mini";

  return { openai, model };
}

export function isConfigured(apiKey: string | undefined): boolean {
  return !!apiKey && apiKey.startsWith("sk-");
}

export async function askAI(
  apiKey: string,
  prompt: string,
  context?: string
) {
  const { openai, model } = createAIProvider({ apiKey });

  const systemPrompt = context
    ? `You are a helpful hackathon assistant. Use this graph data context to answer:\n\n${context}`
    : "You are a helpful hackathon assistant.";

  const result = await generateText({
    model: openai(model),
    system: systemPrompt,
    prompt,
  });

  return result.text;
}

export async function askAIStreaming(
  apiKey: string,
  prompt: string,
  context?: string
) {
  const { openai, model } = createAIProvider({ apiKey });

  const systemPrompt = context
    ? `You are a helpful hackathon assistant. Use this graph data context to answer:\n\n${context}`
    : "You are a helpful hackathon assistant.";

  return streamText({
    model: openai(model),
    system: systemPrompt,
    prompt,
  });
}
