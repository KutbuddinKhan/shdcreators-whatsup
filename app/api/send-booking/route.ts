/**
 * app/api/send-booking/route.ts
 * ─────────────────────────────────────────────────────────────
 * POST /api/send-booking
 * Body: { phone: string }
 * Sends a WhatsApp booking link to the patient from the dashboard.
 * ─────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logMessage } from "@/lib/supabase";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => null);
    const phone: string = body?.phone ?? "";

    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }

    const calendlyUrl = process.env.CALENDLY_EVENT_URL ?? "";
    const message = `We'd love to get you booked in. Here's the link to choose a time that works for you: ${calendlyUrl} — it only takes a minute. Once you've booked, you'll get a confirmation by email.`;

    await sendWhatsAppMessage(phone, message);

    await logMessage({
      patient_phone: phone,
      direction: "outbound",
      content: message,
      intent: "booking_request",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/send-booking] Error:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
