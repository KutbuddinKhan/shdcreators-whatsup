/**
 * lib/intents.ts
 * ─────────────────────────────────────────────────────────────
 * Intent type definitions and their dashboard colour mappings.
 * ─────────────────────────────────────────────────────────────
 */

/** All valid intent categories the AI can classify. */
export type Intent =
  | "booking_request"
  | "pricing_query"
  | "treatment_question"
  | "emergency"
  | "post_treatment_care"
  | "hours_location"
  | "insurance_payment"
  | "general";

/** Colour for each intent — used in the dashboard dots and tags. */
export const INTENT_COLOURS: Record<Intent, string> = {
  booking_request: "#2563EB",
  emergency: "#DC2626",
  pricing_query: "#059669",
  treatment_question: "#7C3AED",
  post_treatment_care: "#D97706",
  hours_location: "#6B7280",
  insurance_payment: "#0D9488",
  general: "#9CA3AF",
};

/** Human-readable label for each intent. */
export const INTENT_LABELS: Record<Intent, string> = {
  booking_request: "Booking",
  emergency: "Emergency",
  pricing_query: "Pricing",
  treatment_question: "Treatment",
  post_treatment_care: "Aftercare",
  hours_location: "Hours / Location",
  insurance_payment: "Insurance / Payment",
  general: "General",
};

/**
 * Parse a raw intent string from the AI response.
 * Falls back to "general" if the value is unrecognised.
 */
export function parseIntent(raw: string): Intent {
  const valid: Intent[] = [
    "booking_request",
    "pricing_query",
    "treatment_question",
    "emergency",
    "post_treatment_care",
    "hours_location",
    "insurance_payment",
    "general",
  ];
  const cleaned = raw.trim().toLowerCase() as Intent;
  return valid.includes(cleaned) ? cleaned : "general";
}
