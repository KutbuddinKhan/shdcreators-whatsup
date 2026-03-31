/**
 * app/api/patients/route.ts
 * GET /api/patients — includes unread count per patient
 */

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export interface PatientSummary {
  phone: string;
  lastMessage: string;
  lastMessageAt: string;
  lastIntent: string;
  totalMessages: number;
  firstContactAt: string;
  unreadCount: number;
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("messages")
      .select("patient_phone, content, intent, created_at, direction, is_read")
      .order("created_at", { ascending: true });

    if (error)
      return NextResponse.json({ error: "Database error" }, { status: 500 });

    const map = new Map<string, PatientSummary>();

    for (const row of data ?? []) {
      const existing = map.get(row.patient_phone);
      const isUnread = row.direction === "inbound" && !row.is_read;

      if (!existing) {
        map.set(row.patient_phone, {
          phone: row.patient_phone,
          lastMessage: row.content,
          lastMessageAt: row.created_at,
          lastIntent: row.intent,
          totalMessages: 1,
          firstContactAt: row.created_at,
          unreadCount: isUnread ? 1 : 0,
        });
      } else {
        existing.lastMessage = row.content;
        existing.lastMessageAt = row.created_at;
        existing.lastIntent = row.intent;
        existing.totalMessages += 1;
        if (isUnread) existing.unreadCount += 1;
      }
    }

    const patients = Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );

    return NextResponse.json(patients);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
