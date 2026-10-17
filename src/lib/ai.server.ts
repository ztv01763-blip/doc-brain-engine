import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const MODEL = "openai/gpt-6-astra";

export async function runAi(instructions: string, prompt: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: [{ role: "user", content: prompt }],
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = await result.text;
  if (failure && !text) {
    const status = (failure as { statusCode?: number }).statusCode;
    if (status === 429) throw new Error("Too many requests — thori der baad try karein.");
    if (status === 402) throw new Error("AI credits khatam ho gaye — workspace mein credits add karein.");
    throw new Error("AI request failed. Dobara try karein.");
  }
  return text;
}
