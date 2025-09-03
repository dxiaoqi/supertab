import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "edge";

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<{
    messages: Array<Omit<UIMessage, 'id'>>;
    apiKey: string;
    baseUrl: string;
  }>;
  const { messages, apiKey, baseUrl } = body;

  const resolvedApiKey = (apiKey as string) || process.env.OPENAI_API_KEY;
  const resolvedBaseUrl = ((baseUrl as string) || process.env.OPENAI_BASE_URL) || undefined;

  if (!resolvedApiKey) {
    return new Response("Missing OPENAI_API_KEY", { status: 500 });
  }

  const openai = createOpenAI({ apiKey: resolvedApiKey, baseURL: resolvedBaseUrl });

  const modelMessages = convertToModelMessages(messages || []);

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: "You are a helpful assistant.",
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}


