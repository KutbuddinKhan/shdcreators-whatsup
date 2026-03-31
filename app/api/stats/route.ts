/**
 * app/api/stats/route.ts
 * GET — dashboard stats: today's messages, patients, bookings
 */

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export interface DashboardStats {
  totalPatientsToday: number;
  totalMessagesToday: number;
  bookingsSentToday: number;
  unreadTotal: number;
  topIntent: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("messages")
      .select("patient_phone, direction, intent, is_read, created_at")
      .gte("created_at", todayStart.toISOString());

    const rows = data ?? [];

    const patientsToday = new Set(rows.map((r) => r.patient_phone)).size;
    const messagesToday = rows.length;
    const bookingsToday = rows.filter(
      (r) => r.intent === "booking_request" && r.direction === "outbound",
    ).length;
    const unreadTotal = rows.filter(
      (r) => r.direction === "inbound" && !r.is_read,
    ).length;

    // Most common inbound intent today
    const intentCounts: Record<string, number> = {};
    for (const r of rows.filter((r) => r.direction === "inbound")) {
      intentCounts[r.intent] = (intentCounts[r.intent] ?? 0) + 1;
    }
    const topIntent =
      Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    return NextResponse.json({
      totalPatientsToday: patientsToday,
      totalMessagesToday: messagesToday,
      bookingsSentToday: bookingsToday,
      unreadTotal,
      topIntent,
    } satisfies DashboardStats);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
