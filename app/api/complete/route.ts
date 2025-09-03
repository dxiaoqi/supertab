import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { input, apiKey, baseUrl } = await req.json();

    const resolvedApiKey = (apiKey as string) || process.env.OPENAI_API_KEY;
    const resolvedBaseUrl = ((baseUrl as string) || process.env.OPENAI_BASE_URL) || undefined;

    if (!resolvedApiKey) {
      return new Response("Missing OPENAI_API_KEY", { status: 500 });
    }

    if (!input || typeof input !== "string") {
      return new Response(
        JSON.stringify({ suggestion: "" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const openai = createOpenAI({ apiKey: resolvedApiKey, baseURL: resolvedBaseUrl });

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system:
        "You predict the user's next input. Return a short continuation only, without quotes or explanations.",
      prompt:
        `User input so far: "${input}"
Continue the text with a plausible short next fragment. Keep it concise (<= 12 words).`,
      maxOutputTokens: 48,
      temperature: 0.7,
    });

    const raw = (text || "").trim();
    const cleaned = sanitizeSuggestion(raw);
    const suggestion = removeOverlap(input, cleaned);
    return new Response(
      JSON.stringify({ suggestion }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ suggestion: "" }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  }
}

function sanitizeSuggestion(s: string): string {
  let out = s.trim();
  // strip code fences
  if (out.startsWith("```") && out.endsWith("```")) {
    out = out.replace(/^```[a-zA-Z0-9_-]*\n?/, "");
    out = out.replace(/\n?```$/, "");
    out = out.trim();
  }
  // strip one level of surrounding quotes/backticks/Chinese quotes
  const pairs: Array<[string, string]> = [["\"", "\""], ["'", "'"], ["`", "`"], ["“", "”"], ["『", "』"], ["「", "」"]];
  for (const [l, r] of pairs) {
    if (out.startsWith(l) && out.endsWith(r) && out.length >= 2) {
      out = out.slice(1, -1).trim();
      break;
    }
  }
  // avoid leading/trailing stray quotes/backticks after trimming
  out = out.replace(/^["'`“”]+/, "").replace(/["'`“”]+$/, "").trim();
  return out;
}

function removeOverlap(context: string, suggestion: string): string {
  if (!context || !suggestion) return suggestion;
  const max = Math.min(context.length, suggestion.length);
  for (let k = max; k > 0; k--) {
    if (context.slice(-k) === suggestion.slice(0, k)) {
      return suggestion.slice(k);
    }
  }
  return suggestion;
}


