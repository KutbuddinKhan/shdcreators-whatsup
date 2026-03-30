/**
 * lib/whatsapp.ts
 * ─────────────────────────────────────────────────────────────
 * Helpers for interacting with the WhatsApp Cloud API.
 * Covers sending text messages and marking messages as read.
 * ─────────────────────────────────────────────────────────────
 */

const WA_BASE = "https://graph.facebook.com/v19.0";

function getCredentials() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in env",
    );
  }
  return { phoneNumberId, accessToken };
}

// ── Send a text message ───────────────────────────────────────

export async function sendWhatsAppMessage(
  to: string,
  text: string,
): Promise<void> {
  const { phoneNumberId, accessToken } = getCredentials();

  const response = await fetch(`${WA_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp send failed [${response.status}]: ${body}`);
  }
}

// ── Mark a message as read ────────────────────────────────────

export async function markMessageAsRead(messageId: string): Promise<void> {
  const { phoneNumberId, accessToken } = getCredentials();

  await fetch(`${WA_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  }).catch((err) => {
    // Non-critical — log and continue
    console.error("[WhatsApp] Failed to mark message as read:", err);
  });
}
