/**
 * lib/calendly.ts
 * ─────────────────────────────────────────────────────────────
 * Calendly API helpers.
 * Used to verify that slots exist before sending a booking link.
 * ─────────────────────────────────────────────────────────────
 */

const CALENDLY_BASE = "https://api.calendly.com";

/**
 * Returns true if at least one available slot exists for the
 * configured event type within the next 7 days.
 * Falls back to true on network/API errors so the bot always
 * sends the link rather than blocking the patient.
 */
export async function hasAvailability(): Promise<boolean> {
  try {
    const apiKey = process.env.CALENDLY_API_KEY;
    const eventUrl = process.env.CALENDLY_EVENT_URL;

    if (!apiKey || !eventUrl) return true; // Fail open

    // Get the user info first (needed for the event type lookup)
    const meRes = await fetch(`${CALENDLY_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!meRes.ok) return true;

    const me = await meRes.json();
    const userUri: string = me?.resource?.uri ?? "";

    // Get event types for this user
    const etRes = await fetch(
      `${CALENDLY_BASE}/event_types?user=${encodeURIComponent(userUri)}&active=true`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!etRes.ok) return true;

    const etData = await etRes.json();
    const eventTypes: Array<{ scheduling_url: string; uri: string }> =
      etData?.collection ?? [];

    // Match the configured event URL to an event type URI
    const matched = eventTypes.find((et) =>
      eventUrl.includes(et.scheduling_url.split("/").pop() ?? ""),
    );

    if (!matched) return true; // Can't match — fail open

    // Check availability for the next 7 days
    const startTime = new Date().toISOString();
    const endTime = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const availRes = await fetch(
      `${CALENDLY_BASE}/event_type_available_times?event_type=${encodeURIComponent(
        matched.uri,
      )}&start_time=${encodeURIComponent(
        startTime,
      )}&end_time=${encodeURIComponent(endTime)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!availRes.ok) return true;

    const availData = await availRes.json();
    const slots: unknown[] = availData?.collection ?? [];

    return slots.length > 0;
  } catch {
    // Network error or unexpected response — fail open
    return true;
  }
}
