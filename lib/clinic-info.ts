/**
 * lib/clinic-info.ts
 * ─────────────────────────────────────────────────────────────
 * Static constants about Bright Smile Dental.
 * Import this wherever clinic details are needed.
 * ─────────────────────────────────────────────────────────────
 */

export const CLINIC_INFO = {
  name: "Bright Smile Dental",
  address: "47 Harley Court, London W1G 8NE",
  nearestTube: "Regent's Park",
  phone: "020 7946 0312",
  email: "hello@brightsmile.co.uk",
  hours: {
    weekdays: "Monday–Friday 9am–6pm",
    saturday: "Saturday 9am–2pm",
    sunday: "Closed Sunday",
  },
  leadDentist: "Dr. Sarah Okafor (BDS, MFDS RCS)",
  team: "3 dentists, 2 hygienists, 4 reception staff",
  parking:
    "There's an NCP car park on Marylebone Road, about a 5-minute walk from us. Street parking is tricky round here so the NCP is your best bet.",
  accessibility:
    "Yes, we've got step-free access — the surgery is on the ground floor, so no stairs to worry about.",
  cancellationPolicy:
    "We just ask for 24 hours' notice if you need to cancel or reschedule. You can do that through the booking confirmation email or just message us here.",
  waitingTimes:
    "We run pretty much on time — you might wait 5–10 minutes at most. We'll let you know if there's a delay.",
  newPatientRegistration:
    "You don't need to fill in any forms beforehand. Just book a new patient checkup and we'll handle everything at the appointment.",
  insurance:
    "We accept most major dental insurance plans — if you let us know your provider, we can check for you. Best to give us a ring on 020 7946 0312 so the team can confirm your specific cover.",
  finance:
    "For treatments over £500, we offer 0% finance through Paym8, so you can spread the cost. The team can set that up at your appointment.",
  nhsNote:
    "We're a private practice, so our treatments aren't available on the NHS I'm afraid. But we do keep our prices competitive and offer finance options for bigger treatments.",
} as const;
