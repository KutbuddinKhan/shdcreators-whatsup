/**
 * app/api/health/route.ts
 * Pinged every 5 minutes by cron-job.org to prevent cold starts
 */

import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok", ts: Date.now() });
}
