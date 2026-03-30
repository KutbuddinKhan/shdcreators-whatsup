/**
 * lib/gemini.ts
 * ─────────────────────────────────────────────────────────────
 * Google Gemini AI wrapper.
 * Calls Gemini 1.5 Flash with the system prompt + conversation
 * history, then parses the structured INTENT / RESPONSE reply.
 * ─────────────────────────────────────────────────────────────
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseIntent, type Intent } from "./intents";
import { buildSystemPrompt } from "./system-prompt";
import type { MessageRow } from "./supabase";

export interface AIResult {
  intent: Intent;
  reply: string;
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
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY in env");

  const calendlyUrl = process.env.CALENDLY_EVENT_URL ?? "";
  const systemPrompt = buildSystemPrompt(calendlyUrl);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
  });

  // Build the conversation history for Gemini
  // Gemini expects alternating user/model turns
  const history = recentMessages.map((msg) => ({
    role: msg.direction === "inbound" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history });

  const result = await chat.sendMessage(newMessage);
  const raw = result.response.text().trim();

  // Parse the structured response: two lines
  // INTENT: booking_request
  // RESPONSE: the actual message
  const intentMatch = raw.match(/^INTENT:\s*(\w+)/im);
  const responseMatch = raw.match(/^RESPONSE:\s*([\s\S]+)/im);

  const intent = parseIntent(intentMatch?.[1] ?? "general");
  const reply =
    responseMatch?.[1]?.trim() ??
    "I'm sorry, I'm having a quick technical issue. Please call us on 020 7946 0312 and we'll sort you out straight away.";

  return { intent, reply };
}
