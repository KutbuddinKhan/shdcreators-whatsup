/**
 * lib/treatment-info.ts
 * ─────────────────────────────────────────────────────────────
 * All treatment names, prices, and conversational descriptions.
 * Used to build the AI system prompt and answer patient queries.
 * ─────────────────────────────────────────────────────────────
 */

export interface Treatment {
  name: string;
  price: string;
  description: string;
  aftercare?: string;
}

export const TREATMENTS: Treatment[] = [
  {
    name: "New patient checkup",
    price: "£65",
    description:
      "Full examination including X-rays if needed. Takes about 30 minutes. The dentist checks your teeth, gums, mouth, and jaw. Good starting point for any new patient — no referral needed.",
    aftercare: undefined,
  },
  {
    name: "Emergency appointment",
    price: "£85",
    description:
      "Same-day or next-day slot for urgent issues. The dentist assesses the problem, provides immediate pain relief or temporary treatment, then books a follow-up if needed. 20–30 minutes.",
    aftercare: undefined,
  },
  {
    name: "Scale & polish (hygienist)",
    price: "£75",
    description:
      "Done by a hygienist. Removes plaque and tartar buildup, then polishes the teeth. Takes 30–45 minutes. Recommended every 6 months. Mild sensitivity is possible for a day or two after.",
    aftercare: undefined,
  },
  {
    name: "Teeth whitening (take-home)",
    price: "£299",
    description:
      "Custom trays made from impressions. You apply the gel at home for 2 weeks. Results in 2–4 shades lighter. Requires one fitting appointment (20 mins) then you collect the trays a week later.",
    aftercare:
      "Some sensitivity is completely normal for the first 24–48 hours. Avoid very hot or cold food and drinks during that time, and steer clear of anything that stains — red wine, coffee, curry, that sort of thing — for at least 48 hours.",
  },
  {
    name: "Teeth whitening (in-chair)",
    price: "£450",
    description:
      "Single 1-hour appointment. Stronger gel applied with protective barriers. Immediate results, typically 6–8 shades lighter. Some sensitivity for 24–48 hours is normal.",
    aftercare:
      "Some sensitivity is completely normal for the first 24–48 hours. Avoid very hot or cold food and drinks during that time, and steer clear of anything that stains — red wine, coffee, curry, that sort of thing — for at least 48 hours.",
  },
  {
    name: "Composite bonding",
    price: "£180 per tooth",
    description:
      "Tooth-coloured resin applied and shaped by hand, cured with UV light. Fixes chips, gaps, reshapes teeth. 30–60 minutes per tooth. No drilling in most cases. Lasts 5–7 years with care.",
    aftercare:
      "Try to avoid anything that could stain for the first 48 hours — coffee, red wine, turmeric. Don't bite into hard foods like apples directly with the bonded teeth. They're strong, but treat them gently for the first couple of days.",
  },
  {
    name: "Porcelain veneers",
    price: "£750 per tooth",
    description:
      "Thin porcelain shells bonded to the front of the teeth. Two appointments — first for prep and impressions (1hr), second for fitting (1hr). Lasts 10–15 years. A small amount of enamel is removed so this is a permanent change.",
    aftercare:
      "Try to avoid anything that could stain for the first 48 hours — coffee, red wine, turmeric. Don't bite into hard foods directly with the veneers. Treat them gently for the first couple of days.",
  },
  {
    name: "Invisalign",
    price: "from £2,800",
    description:
      "Clear aligners that straighten teeth over 6–18 months depending on the case. Requires an initial scan and consultation, then aligners are changed every 1–2 weeks. Check-ups every 6–8 weeks. Must be worn 22 hours per day.",
    aftercare: undefined,
  },
  {
    name: "Dental implant",
    price: "from £2,200",
    description:
      "Titanium post placed in the jawbone, heals for 3–6 months, then a crown is fitted on top. The full process takes 4–9 months. Requires an initial consultation with X-rays or CT scan. Not suitable for everyone — bone density assessment needed.",
    aftercare: undefined,
  },
  {
    name: "Tooth extraction (simple)",
    price: "£120",
    description:
      "Local anaesthetic, tooth removed, takes 20–30 minutes. Some swelling and tenderness for 2–3 days. Stitches are sometimes needed.",
    aftercare:
      "Bite gently on the gauze pad for 30 minutes. Stick to soft foods for the first day, avoid hot drinks, and don't smoke or use a straw — the suction can disturb the clot. Some swelling and tenderness is normal for 2–3 days. Paracetamol or ibuprofen should keep you comfortable.",
  },
  {
    name: "Root canal treatment",
    price: "from £350",
    description:
      "Removes infected pulp from inside the tooth. 1–2 appointments, 60–90 minutes each. Saves the tooth from extraction. A crown is usually recommended after to protect the tooth.",
    aftercare:
      "A bit of tenderness is normal for a few days. Paracetamol or ibuprofen should help. Avoid chewing on that side until your follow-up appointment. If you get increasing pain or swelling after a couple of days, give us a call.",
  },
  {
    name: "White fillings",
    price: "from £95",
    description:
      "Tooth-coloured composite replaces decay. 30–45 minutes. Numbing with local anaesthetic. You can eat and drink normally after the numbness wears off (1–2 hours).",
    aftercare:
      "The numbness will wear off in 1–2 hours — be careful not to bite your cheek or tongue while it's still numb. You can eat and drink normally once the feeling comes back.",
  },
  {
    name: "Dental bridge (3 unit)",
    price: "from £1,800",
    description:
      "A replacement tooth held in place by crowns on adjacent teeth. Two appointments — prep and impressions, then fitting. Takes about 2 weeks total. Lasts 10–15 years.",
    aftercare: undefined,
  },
  {
    name: "Children's checkup (under 18)",
    price: "£45",
    description:
      "Gentle exam for under 18s. The dentist checks development, decay, and gives oral hygiene advice. Takes 20 minutes. Parents are welcome in the room.",
    aftercare: undefined,
  },
];
