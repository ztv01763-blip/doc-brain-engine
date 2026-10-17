import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Lang = z.enum(["English", "Roman Urdu", "Urdu"]);
const Tone = z.enum(["Friendly", "Professional", "Firm"]);

const ReminderInput = z.object({
  shop: z.string().max(120),
  language: Lang,
  tone: Tone,
  currency: z.string().max(8),
  items: z
    .array(
      z.object({
        id: z.string().max(60),
        name: z.string().max(120),
        balance: z.number(),
        daysSincePayment: z.number(),
        reason: z.string().max(200),
      }),
    )
    .max(40),
});

export const generateReminders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ReminderInput.parse(d))
  .handler(async ({ data }) => {
    const { runAi } = await import("./ai.server");
    if (data.items.length === 0) return { messages: [] as { id: string; text: string }[] };
    const instructions = `You write short, respectful payment reminder messages (WhatsApp/SMS) for a small shop's credit ledger (udhaar khata). Shop name: "${data.shop}". Language: ${data.language}${data.language === "Urdu" ? " (Urdu script)" : ""}. Tone: ${data.tone}. Each message max 60 words, mention exact balance with currency "${data.currency}", no threats, no fake facts, sign off with the shop name. Return ONLY a JSON array like [{"id":"...","text":"..."}], one entry per customer, same ids.`;
    const raw = await runAi(instructions, JSON.stringify(data.items));
    const match = raw.match(/\[[\s\S]*\]/);
    try {
      const parsed = JSON.parse(match ? match[0] : raw) as { id: string; text: string }[];
      return { messages: parsed.filter((m) => m && typeof m.text === "string").map((m) => ({ id: String(m.id), text: m.text.slice(0, 1200) })) };
    } catch {
      throw new Error("AI ka jawab samajh nahi aaya. Dobara try karein.");
    }
  });

const AskInput = z.object({
  shop: z.string().max(120),
  language: Lang,
  question: z.string().min(1).max(2000),
  summary: z.string().max(12000),
});

export const askAdvisor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AskInput.parse(d))
  .handler(async ({ data }) => {
    const { runAi } = await import("./ai.server");
    const instructions = `You are CrediOO AI, a practical business advisor for a small Pakistani shopkeeper running a credit ledger. Shop: "${data.shop}". Answer in ${data.language}. Use ONLY the ledger data provided for facts; if data is missing, say so. Be concise, use short bullet points and give actionable steps for collecting dues and managing risk.`;
    const text = await runAi(instructions, `Ledger summary:\n${data.summary}\n\nQuestion: ${data.question}`);
    return { text };
  });
