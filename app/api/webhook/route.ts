/**
 * app/api/webhook/route.ts
 * ─────────────────────────────────────────────────────────────
 * WhatsApp Cloud API webhook.
 * GET  — token verification (required by Meta)
 * POST — incoming message processing
 *
 * Returns 200 immediately to avoid webhook timeouts.
 * AI processing happens asynchronously after the response.
 * ─────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureMessagesTable,
  logMessage,
  getRecentMessages,
  isDuplicateMessage,
  getSupabaseClient,
} from "@/lib/supabase";
import { getAIResponse } from "@/lib/gemini";
import { sendWhatsAppMessage, markMessageAsRead } from "@/lib/whatsapp";

// ── WhatsApp payload types ────────────────────────────────────

interface WhatsAppTextMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppValue {
  statuses?: unknown[];
  messages?: WhatsAppTextMessage[];
}

interface WhatsAppChange {
  value?: WhatsAppValue;
}

interface WhatsAppEntry {
  changes?: WhatsAppChange[];
}

interface WhatsAppPayload {
  entry?: WhatsAppEntry[];
}

// ── GET: Webhook verification ─────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_WEBHOOKS_VERIFY_TOKEN
  ) {
    console.log("[Webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[Webhook] Verification failed — token mismatch");
  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST: Incoming messages ───────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Return 200 immediately so Meta doesn't retry the webhook
  const body = await req.json().catch(() => null) as WhatsAppPayload | null;

  // Process asynchronously — do not await
  processIncomingMessage(body).catch((err: unknown) => {
    console.error("[Webhook] Unhandled processing error:", err);
  });

  return new NextResponse("OK", { status: 200 });
}

// ── Core processing logic ─────────────────────────────────────

async function processIncomingMessage(
  body: WhatsAppPayload | null
): Promise<void> {
  try {
    await ensureMessagesTable();

    // Safely extract the message from the WhatsApp payload
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignore status updates (read receipts, delivery receipts)
    if (value?.statuses) return;

    const messages = value?.messages ?? [];
    if (messages.length === 0) return;

    const message = messages[0];
    const messageId: string = message?.id ?? "";
    const from: string = message?.from ?? ""; // Sender phone in E.164
    const type: string = message?.type ?? "";

    if (!from || !messageId) return;

    // Deduplicate — ignore if we've already processed this message ID
    if (messageId && (await isDuplicateMessage(messageId))) {
      console.log(`[Webhook] Duplicate message ignored: ${messageId}`);
      return;
    }

    // Handle unsupported message types (audio, image, etc.)
    if (type !== "text") {
      const fallback =
        "Thanks for sending that — unfortunately I can only read text messages at the moment. Could you describe what you need and I'll do my best to help?";

      await sendWhatsAppMessage(from, fallback);
      await logMessage({
        patient_phone: from,
        direction: "inbound",
        content: `[${type} message — not supported]`,
        intent: "general",
        whatsapp_message_id: messageId,
      });
      await logMessage({
        patient_phone: from,
        direction: "outbound",
        content: fallback,
        intent: "general",
      });
      return;
    }

    const inboundText: string = message?.text?.body ?? "";
    if (!inboundText.trim()) return;

    // Log the inbound message immediately
    await logMessage({
      patient_phone: from,
      direction: "inbound",
      content: inboundText,
      intent: "general", // Will be updated after AI processes it
      whatsapp_message_id: messageId,
    });

    // Mark as read in WhatsApp (fire and forget — non-critical)
    void markMessageAsRead(messageId);

    // Fetch last 6 messages for context
    const recentMessages = await getRecentMessages(from, 6);

    // Call Gemini
    const { intent, reply } = await getAIResponse(recentMessages, inboundText);

    // Log the outbound reply with the detected intent
    await logMessage({
      patient_phone: from,
      direction: "outbound",
      content: reply,
      intent,
    });

    // Also update the inbound message's intent (best-effort, non-critical)
    const supabase = getSupabaseClient();
    void supabase
      .from("messages")
      .update({ intent })
      .eq("whatsapp_message_id", messageId);

    // Send the reply to the patient
    await sendWhatsAppMessage(from, reply);
  } catch (err: unknown) {
    console.error("[Webhook] Processing failed:", err);
    // We can't recover gracefully here without knowing the sender,
    // so we just log and move on.
  }
}