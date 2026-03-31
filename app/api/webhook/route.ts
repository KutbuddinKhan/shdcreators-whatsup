/**
 * app/api/webhook/route.ts
 * WhatsApp webhook — respects per-patient AI on/off toggle
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_WEBHOOKS_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as WhatsAppPayload | null;
  processIncomingMessage(body).catch((err: unknown) => {
    console.error("[Webhook] Error:", err);
  });
  return new NextResponse("OK", { status: 200 });
}

async function processIncomingMessage(
  body: WhatsAppPayload | null
): Promise<void> {
  let senderPhone = "";
  try {
    await ensureMessagesTable();

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    if (value?.statuses) return;

    const messages = value?.messages ?? [];
    if (messages.length === 0) return;

    const message = messages[0];
    const messageId = message?.id ?? "";
    const from = message?.from ?? "";
    const type = message?.type ?? "";
    senderPhone = from;

    if (!from || !messageId) return;
    if (await isDuplicateMessage(messageId)) return;

    if (type !== "text") {
      const fallback =
        "Thanks for sending that — unfortunately I can only read text messages at the moment. Could you describe what you need and I'll do my best to help?";
      await sendWhatsAppMessage(from, fallback);
      await logMessage({
        patient_phone: from,
        direction: "inbound",
        content: `[${type} message]`,
        intent: "general",
        whatsapp_message_id: messageId,
        is_ai: false,
      });
      await logMessage({
        patient_phone: from,
        direction: "outbound",
        content: fallback,
        intent: "general",
        is_ai: true,
      });
      return;
    }

    const inboundText = message?.text?.body ?? "";
    if (!inboundText.trim()) return;

    await logMessage({
      patient_phone: from,
      direction: "inbound",
      content: inboundText,
      intent: "general",
      whatsapp_message_id: messageId,
      is_read: false,
      is_ai: false,
    });

    void markMessageAsRead(messageId);

    const aiEnabled = await isAIEnabled(from);
    if (!aiEnabled) return;

    // ── Signal typing indicator ON ────────────────────────────
    try {
      await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/typing-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: from }),
      });
    } catch { /* non-critical */ }

    const recentMessages = await getRecentMessages(from, 6);
    const { intent, reply } = await getAIResponse(recentMessages, inboundText);

    // ── Signal typing indicator OFF ───────────────────────────
    try {
      await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/typing-status`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: from }),
      });
    } catch { /* non-critical */ }

    await logMessage({
      patient_phone: from,
      direction: "outbound",
      content: reply,
      intent,
      is_read: true,
      is_ai: true,
    });

    const supabase = getSupabaseClient();
    void supabase
      .from("messages")
      .update({ intent })
      .eq("whatsapp_message_id", messageId);

    await sendWhatsAppMessage(from, reply);
  } catch (err) {
    console.error("[Webhook] Processing failed:", err);

    // Clear typing indicator on error
    if (senderPhone) {
      try {
        await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/typing-status`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: senderPhone }),
        });
      } catch { /* non-critical */ }
    }
  }
}

// VERCEL_URL=https://shdcreators-whatsup.vercel.app/