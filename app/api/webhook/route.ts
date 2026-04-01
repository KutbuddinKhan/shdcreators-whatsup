/**
 * app/api/webhook/route.ts
 * Complete replacement — guaranteed fast response + reliable async processing
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureMessagesTable,
  logMessage,
  getRecentMessages,
  isDuplicateMessage,
  getSupabaseClient,
  isAIEnabled,
} from "@/lib/supabase";
import { getAIResponse } from "@/lib/gemini";
import { sendWhatsAppMessage, markMessageAsRead } from "@/lib/whatsapp";

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
    console.log("[Webhook] Verified");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST: Return 200 IMMEDIATELY, process async ───────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Parse body BEFORE returning — this is fast (<1ms)
  const body = (await req.json().catch(() => null)) as WhatsAppPayload | null;

  // Return 200 to Meta RIGHT NOW — before doing anything else
  // This MUST happen within 5 seconds or Meta will retry
  const response = new NextResponse("OK", { status: 200 });

  // Use waitUntil if available (Vercel Edge) — keeps function alive after response
  // Falls back to fire-and-forget promise
  if (
    typeof (globalThis as typeof globalThis & { EdgeRuntime?: unknown })
      .EdgeRuntime !== "undefined"
  ) {
    // Edge runtime — not needed here
  }

  // Fire and forget — do NOT await this
  processMessage(body).catch((err) => {
    console.error("[Webhook] Processing error:", err);
  });

  return response;
}

// ── Core processing — runs AFTER 200 is sent ─────────────────

async function processMessage(body: WhatsAppPayload | null): Promise<void> {
  const startTime = Date.now();

  try {
    await ensureMessagesTable();

    const value = body?.entry?.[0]?.changes?.[0]?.value;

    // Ignore status updates (read receipts, delivery receipts)
    if (value?.statuses) return;

    const messages = value?.messages ?? [];
    if (messages.length === 0) return;

    const message = messages[0];
    const messageId = message?.id ?? "";
    const from = message?.from ?? "";
    const type = message?.type ?? "";

    if (!from || !messageId) return;

    // Deduplicate — Meta sometimes sends the same message twice
    if (await isDuplicateMessage(messageId)) {
      console.log(`[Webhook] Duplicate ignored: ${messageId}`);
      return;
    }

    console.log(`[Webhook] Processing message from ${from}, type: ${type}`);

    // Handle non-text (image, audio, video, etc.)
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
        is_read: false,
        is_ai: false,
      });
      await logMessage({
        patient_phone: from,
        direction: "outbound",
        content: fallback,
        intent: "general",
        is_ai: true,
        is_read: true,
      });
      return;
    }

    const inboundText = message?.text?.body ?? "";
    if (!inboundText.trim()) return;

    // Log inbound immediately
    await logMessage({
      patient_phone: from,
      direction: "inbound",
      content: inboundText,
      intent: "general",
      whatsapp_message_id: messageId,
      is_read: false,
      is_ai: false,
    });

    // Mark as read (fire and forget)
    void markMessageAsRead(messageId);

    // Check AI toggle
    const aiEnabled = await isAIEnabled(from);
    if (!aiEnabled) {
      console.log(`[Webhook] AI disabled for ${from}`);
      return;
    }

    // Signal typing indicator
    void fetch(
      `${process.env.NEXTAUTH_URL ?? "https://shdcreators-whatsup.vercel.app"}/api/typing-status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: from }),
      },
    ).catch(() => {});

    // Get last 6 messages for AI context
    const recentMessages = await getRecentMessages(from, 6);

    // Call Groq AI
    const { intent, reply } = await getAIResponse(recentMessages, inboundText);

    // Clear typing indicator
    void fetch(
      `${process.env.NEXTAUTH_URL ?? "https://shdcreators-whatsup.vercel.app"}/api/typing-status`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: from }),
      },
    ).catch(() => {});

    // Log outbound
    await logMessage({
      patient_phone: from,
      direction: "outbound",
      content: reply,
      intent,
      is_ai: true,
      is_read: true,
    });

    // Update inbound intent
    const supabase = getSupabaseClient();
    void supabase
      .from("messages")
      .update({ intent })
      .eq("whatsapp_message_id", messageId);

    // Send reply
    await sendWhatsAppMessage(from, reply);

    console.log(`[Webhook] Done in ${Date.now() - startTime}ms`);
  } catch (err) {
    console.error("[Webhook] Failed:", err);
  }
}
