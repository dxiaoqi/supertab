import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "edge";

export async function POST(req: Request) {
  const { messages, apiKey, baseUrl } = await req.json();

  const resolvedApiKey = (apiKey as string) || process.env.OPENAI_API_KEY;
  const resolvedBaseUrl = ((baseUrl as string) || process.env.OPENAI_BASE_URL) || undefined;

  if (!resolvedApiKey) {
    return new Response("Missing OPENAI_API_KEY", { status: 500 });
  }

  const openai = createOpenAI({ apiKey: resolvedApiKey, baseURL: resolvedBaseUrl });

  const modelMessages = convertToModelMessages(
    (messages || []).map((m: any) => {
      const { id, ...rest } = m || {};
      return rest;
    })
  );

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: "You are a helpful assistant.",
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}


