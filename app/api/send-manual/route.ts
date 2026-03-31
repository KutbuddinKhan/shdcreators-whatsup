/**
 * app/api/send-manual/route.ts
 * POST { phone, message } — staff sends a manual WhatsApp message
 */

import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logMessage } from "@/lib/supabase";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { phone, message } = await req.json().catch(() => ({}));
    if (!phone || !message?.trim()) {
      return NextResponse.json(
        { error: "Phone and message required" },
        { status: 400 },
      );
    }

    await sendWhatsAppMessage(phone, message.trim());
    await logMessage({
      patient_phone: phone,
      direction: "outbound",
      content: message.trim(),
      intent: "general",
      is_read: true,
      is_ai: false,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-manual] Error:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
