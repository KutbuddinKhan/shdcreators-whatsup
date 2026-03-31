/**
 * app/api/patient-meta/[phone]/route.ts
 * GET  — fetch patient notes, tags, AI toggle
 * POST — update patient notes, tags, AI toggle
 */

import { NextRequest, NextResponse } from "next/server";
import { getPatientMeta, upsertPatientMeta } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
): Promise<NextResponse> {
  const { phone } = await params;
  const decoded = decodeURIComponent(phone);
  const meta = await getPatientMeta(decoded);
  return NextResponse.json(
    meta ?? { patient_phone: decoded, notes: "", tags: [], ai_enabled: true },
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
): Promise<NextResponse> {
  const { phone } = await params;
  const decoded = decodeURIComponent(phone);
  const body = await req.json().catch(() => ({}));
  await upsertPatientMeta(decoded, body);
  return NextResponse.json({ success: true });
}
