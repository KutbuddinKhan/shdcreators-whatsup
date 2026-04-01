/**
 * app/api/webhook-ping/route.ts
 * ─────────────────────────────────────────────────────────────
 * Keeps the webhook function warm by importing and touching
 * the same dependencies the webhook uses.
 * Hit this every 1 minute via cron-job.org
 * ─────────────────────────────────────────────────────────────
 */

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(): Promise<NextResponse> {
  try {
    // Touch Supabase to keep that connection warm too
    const supabase = getSupabaseClient();
    await supabase.from("messages").select("id").limit(1);

    return NextResponse.json({
      status: "warm",
      ts: Date.now(),
      fn: "webhook",
    });
  } catch {
    return NextResponse.json({ status: "warm", ts: Date.now() });
  }
}
