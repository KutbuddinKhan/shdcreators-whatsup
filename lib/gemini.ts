/**
 * lib/gemini.ts
 * ─────────────────────────────────────────────────────────────
 * Google Gemini AI wrapper using direct REST API calls.
 * More reliable on Vercel than the SDK package.
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

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text: string }[];
    };
  }[];
  error?: {
    message: string;
    code: number;
  };
}

/**
 * Send the conversation to Gemini and return the parsed intent + reply.
 * @param recentMessages - Last 6 messages for this patient (chronological)
 * @param newMessage     - The latest inbound message text
 */
export async function getAIResponse(
  recentMessages: MessageRow[],
  newMessage: string,
): Promise<AIResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("[Gemini] GEMINI_API_KEY is not set");
    return { intent: "general", reply: FALLBACK_REPLY };
  }

  const calendlyUrl = process.env.CALENDLY_EVENT_URL ?? "";
  const systemPrompt = buildSystemPrompt(calendlyUrl);

  // Build conversation history for Gemini
  // Gemini requires alternating user/model turns and cannot start with model
  const history: GeminiContent[] = recentMessages
    .filter((msg) => msg.content && msg.content.trim().length > 0)
    .map((msg) => ({
      role: msg.direction === "inbound" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

  // Ensure history alternates properly — remove consecutive same-role turns
  const cleanHistory: GeminiContent[] = [];
  for (const turn of history) {
    const last = cleanHistory[cleanHistory.length - 1];
    if (last && last.role === turn.role) {
      // Merge consecutive same-role messages
      last.parts[0].text += "\n" + turn.parts[0].text;
    } else {
      cleanHistory.push({ ...turn, parts: [{ text: turn.parts[0].text }] });
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      ...cleanHistory,
      {
        role: "user",
        parts: [{ text: newMessage }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
    },
  };

  let raw = "";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = (await response.json()) as GeminiResponse;

    // Log the full response in Vercel logs for debugging
    console.log("[Gemini] Status:", response.status);

    if (!response.ok || data.error) {
      console.error("[Gemini] API error:", JSON.stringify(data.error ?? data));
      return { intent: "general", reply: FALLBACK_REPLY };
    }

    raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (!raw) {
      console.error("[Gemini] Empty response from API");
      return { intent: "general", reply: FALLBACK_REPLY };
    }

    console.log("[Gemini] Raw response:", raw.substring(0, 200));
  } catch (err: unknown) {
    console.error("[Gemini] Network/fetch error:", err);
    return { intent: "general", reply: FALLBACK_REPLY };
  }

  // Parse structured response:
  // INTENT: booking_request
  // RESPONSE: the actual message
  const intentMatch = raw.match(/^INTENT:\s*(\w+)/im);
  const responseMatch = raw.match(/^RESPONSE:\s*([\s\S]+)/im);

  const intent = parseIntent(intentMatch?.[1] ?? "general");
  const reply = responseMatch?.[1]?.trim() ?? raw;

  // If the model didn't follow the format, use the whole response as reply
  if (!responseMatch) {
    console.warn(
      "[Gemini] Response did not follow INTENT/RESPONSE format. Using raw text.",
    );
  }

  return { intent, reply };
}
