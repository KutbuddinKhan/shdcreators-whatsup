/**
 * app/api/messages/[phone]/route.ts
 * GET /api/messages/[phone]?after=ISO_TIMESTAMP
 * Returns all messages, or only messages after a given timestamp.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
): Promise<NextResponse> {
  try {
    const { phone } = await params;
    if (!phone)
      return NextResponse.json({ error: "Phone required" }, { status: 400 });

    const decoded = decodeURIComponent(phone);
    const after = new URL(req.url).searchParams.get("after");
    const supabase = getSupabaseClient();

    let query = supabase
      .from("messages")
      .select("*")
      .eq("patient_phone", decoded)
      .order("created_at", { ascending: true });

    // If ?after= is provided, only return newer messages
    if (after) {
      query = query.gt("created_at", after);
    }

    const { data, error } = await query;

    if (error)
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
