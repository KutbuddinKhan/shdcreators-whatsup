/**
 * lib/supabase.ts
 * Supabase client + all DB helper functions
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────

export interface MessageRow {
  id?: string;
  patient_phone: string;
  direction: "inbound" | "outbound";
  content: string;
  intent: string;
  whatsapp_message_id?: string;
  is_read?: boolean;
  is_ai?: boolean;
  created_at?: string;
}

export interface PatientMeta {
  id?: string;
  patient_phone: string;
  notes: string;
  tags: string[];
  ai_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// ── Singleton client ─────────────────────────────────────────

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  _client = createClient(url, key);
  return _client;
}

// ── Table verification ───────────────────────────────────────

let tableVerified = false;

export async function ensureMessagesTable(): Promise<void> {
  if (tableVerified) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("messages").select("id").limit(1);
  if (error) console.error("[Supabase] Table check error:", error.message);
  tableVerified = true;
}

// ── Message helpers ──────────────────────────────────────────

export async function logMessage(row: MessageRow): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("messages").insert(row);
    if (error) console.error("[Supabase] logMessage error:", error.message);
  } catch (err) {
    console.error("[Supabase] logMessage unexpected:", err);
  }
}

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
    if (error) return [];
    return (data as MessageRow[]).reverse();
  } catch {
    return [];
  }
}

export async function isDuplicateMessage(
  whatsappMessageId: string,
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("messages")
      .select("id")
      .eq("whatsapp_message_id", whatsappMessageId)
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function markMessagesAsRead(phone: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("patient_phone", phone)
      .eq("direction", "inbound")
      .eq("is_read", false);
  } catch (err) {
    console.error("[Supabase] markMessagesAsRead error:", err);
  }
}

// ── Patient meta helpers ─────────────────────────────────────

export async function getPatientMeta(
  phone: string,
): Promise<PatientMeta | null> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("patient_meta")
      .select("*")
      .eq("patient_phone", phone)
      .limit(1);
    return (data?.[0] as PatientMeta) ?? null;
  } catch {
    return null;
  }
}

export async function upsertPatientMeta(
  phone: string,
  updates: Partial<PatientMeta>,
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from("patient_meta")
      .upsert(
        {
          patient_phone: phone,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "patient_phone" },
      );
  } catch (err) {
    console.error("[Supabase] upsertPatientMeta error:", err);
  }
}

export async function isAIEnabled(phone: string): Promise<boolean> {
  const meta = await getPatientMeta(phone);
  // Default to true if no record exists
  return meta?.ai_enabled ?? true;
}
