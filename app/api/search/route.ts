/**
 * app/api/search/route.ts
 * GET /api/search?q=term — searches message content across all patients
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 2) return NextResponse.json([]);

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("messages")
      .select("patient_phone, content, direction, created_at, intent")
      .ilike("content", `%${q}%`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json([]);
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
