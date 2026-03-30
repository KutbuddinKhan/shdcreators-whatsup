/**
 * app/api/debug/route.ts
 * Temporary debug endpoint — DELETE after fixing.
 * Visit: https://your-vercel-url.vercel.app/api/debug
 */

import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set in env" },
      { status: 500 },
    );
  }

  // Test the Gemini API directly
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Say: working" }] }],
          generationConfig: { maxOutputTokens: 50 },
        }),
      },
    );

    const data = await response.json();

    return NextResponse.json({
      status: response.status,
      keyPrefix: geminiKey.substring(0, 8) + "...",
      response: data,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      error: "Fetch failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
