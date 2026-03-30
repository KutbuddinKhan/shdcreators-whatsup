import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "Say: working" }],
          max_tokens: 10,
        }),
      },
    );

    const data = await response.json();

    return NextResponse.json({
      status: response.status,
      keyPrefix: apiKey.substring(0, 8) + "...",
      response: data,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      error: "Fetch failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
