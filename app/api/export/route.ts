/**
 * app/api/export/route.ts
 * ─────────────────────────────────────────────────────────────
 * GET /api/export?phone=XXX&format=csv
 * Exports a patient's full conversation as CSV or JSON.
 * ─────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    const format = searchParams.get("format") ?? "csv";

    if (!phone) {
      return NextResponse.json({ error: "Phone required" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("patient_phone", decodeURIComponent(phone))
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const rows = data ?? [];

    if (format === "csv") {
      // Build CSV
      const headers = [
        "Date",
        "Time",
        "Direction",
        "Content",
        "Intent",
        "Sent By",
      ];

      const csvRows = rows.map((row) => {
        const d = new Date(row.created_at);
        const date = d.toLocaleDateString("en-GB");
        const time = d.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        // Escape quotes in content
        const content = `"${(row.content ?? "").replace(/"/g, '""')}"`;
        const sentBy = row.is_ai ? "AI" : "Staff";
        return [date, time, row.direction, content, row.intent, sentBy].join(
          ",",
        );
      });

      const csv = [headers.join(","), ...csvRows].join("\n");
      const filename = `conversation-${phone.replace(/\+/g, "")}-${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON fallback
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[Export] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
