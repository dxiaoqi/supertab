import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "edge";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": "x-edge-ok, x-elapsed-ms",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

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
    return new Response("Missing OPENAI_API_KEY", { status: 500, headers: corsHeaders });
  }

  const openai = createOpenAI({ apiKey: resolvedApiKey, baseURL: resolvedBaseUrl });

  const modelMessages = convertToModelMessages(messages || []);

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: "You are a helpful assistant.",
    messages: modelMessages,
  });

  const res = result.toUIMessageStreamResponse();
  // toUIMessageStreamResponse returns a Response; clone with CORS headers
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(res.body, { status: res.status, headers });
}


