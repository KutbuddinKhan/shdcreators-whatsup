/**
 * lib/followup-config.ts
 * ─────────────────────────────────────────────────────────────
 * Auto follow-up configuration.
 * Change FOLLOW_UP_HOURS to adjust the follow-up timing.
 * ─────────────────────────────────────────────────────────────
 */

/** Hours after sending a booking link before sending a follow-up */
export const FOLLOW_UP_HOURS = 6;

/** How many follow-ups maximum per patient per booking link sent */
export const MAX_FOLLOW_UPS = 1;

/** The follow-up message text */
export function buildFollowUpMessage(calendlyUrl: string): string {
  return `Hi! Just checking in — were you able to grab a slot? If not, here's the booking link again: ${calendlyUrl} — it only takes a minute. If you have any questions, we're happy to help.`;
}
