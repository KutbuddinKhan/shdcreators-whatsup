/**
 * app/api/mark-read/route.ts
 * POST { phone } — marks all inbound messages as read for a patient
 */

import { NextRequest, NextResponse } from "next/server";
import { markMessagesAsRead } from "@/lib/supabase";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { phone } = await req.json().catch(() => ({}));
  if (!phone)
    return NextResponse.json({ error: "Phone required" }, { status: 400 });
  await markMessagesAsRead(phone);
  return NextResponse.json({ success: true });
}
