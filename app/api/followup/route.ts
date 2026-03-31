/**
 * app/api/followup/route.ts
 * ─────────────────────────────────────────────────────────────
 * GET — called by cron-job.org every 10 minutes
 * Finds patients who received a booking link 6 hours ago
 * and haven't replied or been followed up yet, then sends
 * a gentle reminder via WhatsApp.
 * ─────────────────────────────────────────────────────────────
 */

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logMessage } from "@/lib/supabase";
import {
  FOLLOW_UP_HOURS,
  MAX_FOLLOW_UPS,
  buildFollowUpMessage,
} from "@/lib/followup-config";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseClient();
    const calendlyUrl = process.env.CALENDLY_EVENT_URL ?? "";

    // Window: between FOLLOW_UP_HOURS and FOLLOW_UP_HOURS+10min ago
    const windowEnd = new Date(Date.now() - FOLLOW_UP_HOURS * 60 * 60 * 1000);
    const windowStart = new Date(windowEnd.getTime() - 10 * 60 * 1000); // 10 min window

    // Find outbound messages with booking_request intent in the window
    const { data: bookingMessages } = await supabase
      .from("messages")
      .select("patient_phone, created_at")
      .eq("direction", "outbound")
      .eq("intent", "booking_request")
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString());

    if (!bookingMessages || bookingMessages.length === 0) {
      return NextResponse.json({ checked: 0, sent: 0 });
    }

    let sent = 0;

    for (const booking of bookingMessages) {
      const phone = booking.patient_phone;

      // Check if patient replied AFTER the booking link was sent
      const { data: replies } = await supabase
        .from("messages")
        .select("id")
        .eq("patient_phone", phone)
        .eq("direction", "inbound")
        .gt("created_at", booking.created_at)
        .limit(1);

      if (replies && replies.length > 0) {
        // Patient already replied — skip
        continue;
      }

      // Check how many follow-ups already sent for this patient recently
      const followUpWindow = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: existingFollowUps } = await supabase
        .from("messages")
        .select("id")
        .eq("patient_phone", phone)
        .eq("direction", "outbound")
        .eq("intent", "booking_request")
        .ilike("content", "%checking in%")
        .gte("created_at", followUpWindow);

      if (existingFollowUps && existingFollowUps.length >= MAX_FOLLOW_UPS) {
        // Already followed up — skip
        continue;
      }

      // Send follow-up
      const message = buildFollowUpMessage(calendlyUrl);

      try {
        await sendWhatsAppMessage(phone, message);
        await logMessage({
          patient_phone: phone,
          direction: "outbound",
          content: message,
          intent: "booking_request",
          is_ai: true,
          is_read: true,
        });
        sent++;
        console.log(`[Followup] Sent to ${phone}`);
      } catch (err) {
        console.error(`[Followup] Failed to send to ${phone}:`, err);
      }
    }

    return NextResponse.json({
      checked: bookingMessages.length,
      sent,
      window: `${windowStart.toISOString()} → ${windowEnd.toISOString()}`,
    });
  } catch (err) {
    console.error("[Followup] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
