/**
 * lib/gemini.ts
 * ─────────────────────────────────────────────────────────────
 * AI wrapper using Groq (free, fast) instead of Gemini.
 * Model: llama-3.3-70b-versatile
 * ─────────────────────────────────────────────────────────────
 */

import { parseIntent, type Intent } from "./intents";
import { buildSystemPrompt } from "./system-prompt";
import type { MessageRow } from "./supabase";

export interface AIResult {
  intent: Intent;
  reply: string;
}

const FALLBACK_REPLY =
  "I'm sorry, I'm having a quick technical issue. Please call us on 020 7946 0312 and we'll sort you out straight away.";

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
  error?: {
    message: string;
    code: string;
  };
}

export async function getAIResponse(
  recentMessages: MessageRow[],
  newMessage: string,
): Promise<AIResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.error("[Groq] GROQ_API_KEY is not set");
    return { intent: "general", reply: FALLBACK_REPLY };
  }

  const calendlyUrl = process.env.CALENDLY_EVENT_URL ?? "";
  const systemPrompt = buildSystemPrompt(calendlyUrl);

  // Build conversation history
  const history: GroqMessage[] = recentMessages
    .filter((msg) => msg.content?.trim())
    .map((msg) => ({
      role: msg.direction === "inbound" ? "user" : "assistant",
      content: msg.content,
    }));

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: newMessage },
  ];

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      },
    );

    const data = (await response.json()) as GroqResponse;

    console.log("[Groq] Status:", response.status);

    if (!response.ok || data.error) {
      console.error("[Groq] API error:", JSON.stringify(data.error ?? data));
      return { intent: "general", reply: FALLBACK_REPLY };
    }

    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!raw) {
      console.error("[Groq] Empty response");
      return { intent: "general", reply: FALLBACK_REPLY };
    }

    console.log("[Groq] Raw response:", raw.substring(0, 200));

    // Parse structured response
    const intentMatch = raw.match(/^INTENT:\s*(\w+)/im);
    const responseMatch = raw.match(/^RESPONSE:\s*([\s\S]+)/im);

    const intent = parseIntent(intentMatch?.[1] ?? "general");
    const reply = responseMatch?.[1]?.trim() ?? raw;

    if (!responseMatch) {
      console.warn("[Groq] Response did not follow INTENT/RESPONSE format.");
    }

    return { intent, reply };
  } catch (err: unknown) {
    console.error("[Groq] Network error:", err);
    return { intent: "general", reply: FALLBACK_REPLY };
  }
}
