/**
 * lib/supabase.ts
 * ─────────────────────────────────────────────────────────────
 * Supabase client initialisation and auto-table creation.
 * The messages table is created automatically on first use.
 * ─────────────────────────────────────────────────────────────
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────

export interface MessageRow {
  id?: string;
  patient_phone: string;
  direction: "inbound" | "outbound";
  content: string;
  intent: string;
  whatsapp_message_id?: string;
  created_at?: string;
}

// ── Singleton client (service-role key for server-side use) ───

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  }

  _client = createClient(url, key);
  return _client;
}

// ── Auto-table creation ───────────────────────────────────────

let tableVerified = false;

/**
 * Ensures the messages table exists.
 * Runs once per server process — subsequent calls are no-ops.
 */
export async function ensureMessagesTable(): Promise<void> {
  if (tableVerified) return;

  const supabase = getSupabaseClient();

  // Probe the table — if it doesn't exist Supabase returns a 42P01 error
  const { error } = await supabase.from("messages").select("id").limit(1);

  if (error && error.code === "42P01") {
    // Table does not exist — create it via raw SQL through the REST API
    const { error: createError } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS messages (
          id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_phone       TEXT NOT NULL,
          direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
          content             TEXT NOT NULL,
          intent              TEXT NOT NULL DEFAULT 'general',
          whatsapp_message_id TEXT,
          created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_messages_patient_phone ON messages (patient_phone);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at    ON messages (created_at DESC);
      `,
    });

    if (createError) {
      console.error(
        "[Supabase] Could not auto-create messages table:",
        createError.message,
      );
      console.error(
        "[Supabase] Please create the table manually in your Supabase dashboard using the SQL above.",
      );
    } else {
      console.log("[Supabase] messages table created.");
    }
  }

  tableVerified = true;
}

// ── Helper: log a message row ─────────────────────────────────

export async function logMessage(row: MessageRow): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("messages").insert(row);
    if (error) {
      console.error("[Supabase] Failed to log message:", error.message);
    }
  } catch (err) {
    console.error("[Supabase] Unexpected error logging message:", err);
  }
}

// ── Helper: fetch last N messages for a patient ───────────────

export async function getRecentMessages(
  phone: string,
  limit = 6,
): Promise<MessageRow[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("patient_phone", phone)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(
        "[Supabase] Failed to fetch recent messages:",
        error.message,
      );
      return [];
    }

    // Return in chronological order (oldest first) for AI context
    return (data as MessageRow[]).reverse();
  } catch (err) {
    console.error("[Supabase] Unexpected error fetching messages:", err);
    return [];
  }
}

// ── Helper: check for duplicate WhatsApp message ID ──────────

export async function isDuplicateMessage(
  whatsappMessageId: string,
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("messages")
      .select("id")
      .eq("whatsapp_message_id", whatsappMessageId)
      .limit(1);

    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
