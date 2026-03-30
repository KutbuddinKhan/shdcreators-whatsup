/**
 * app/api/patients/route.ts
 * ─────────────────────────────────────────────────────────────
 * GET /api/patients
 * Returns all unique patients with their last message summary,
 * intent, total message count, and first/last contact dates.
 * Used by the dashboard on initial load.
 * ─────────────────────────────────────────────────────────────
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
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseClient();

    // Fetch all messages — we'll aggregate in JS
    // (Supabase free tier doesn't support window functions via the REST API)
    const { data, error } = await supabase
      .from("messages")
      .select("patient_phone, content, intent, created_at, direction")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[/api/patients] Supabase error:", error.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Group by patient_phone
    const map = new Map<string, PatientSummary>();

    for (const row of data ?? []) {
      const existing = map.get(row.patient_phone);

      if (!existing) {
        map.set(row.patient_phone, {
          phone: row.patient_phone,
          lastMessage: row.content,
          lastMessageAt: row.created_at,
          lastIntent: row.intent,
          totalMessages: 1,
          firstContactAt: row.created_at,
        });
      } else {
        existing.lastMessage = row.content;
        existing.lastMessageAt = row.created_at;
        existing.lastIntent = row.intent;
        existing.totalMessages += 1;
      }
    }

    // Sort newest first
    const patients = Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );

    return NextResponse.json(patients);
  } catch (err) {
    console.error("[/api/patients] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
