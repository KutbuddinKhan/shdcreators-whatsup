/**
 * app/api/messages/[phone]/route.ts
 * ─────────────────────────────────────────────────────────────
 * GET /api/messages/[phone]
 * Returns all messages for a given patient phone number,
 * ordered by created_at ascending (oldest first).
 * ─────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
): Promise<NextResponse> {
  try {
    const { phone } = await params;

    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }

    const decoded = decodeURIComponent(phone);
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("patient_phone", decoded)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[/api/messages] Supabase error:", error.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[/api/messages] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
