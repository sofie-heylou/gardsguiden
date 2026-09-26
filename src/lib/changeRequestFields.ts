/** The farm fields an owner may propose a change to through the structured
 *  "request a change" form, and how each is validated/diffed.
 *
 *  Deliberately narrower than the full Farm type: address/kommun/lan/lat/lng
 *  are excluded (a bad address would silently move the pin on approval, via
 *  re-geocoding — see submissionActions.ts), and internal-only fields
 *  (tier, gardsförsäljningLicense, isArchipelago, photoId, source, addedAt)
 *  are never owner-editable.
 */

export const EDITABLE_FARM_FIELDS = [
  "name",
  "description",
  "phone",
  "email",
  "website",
  "facebook",
  "instagram",
  "openingHours",
  "season",
  "products",
  "onSiteSales",
  "tastingRoom",
  "legomustning",
] as const;

export type EditableFarmField = (typeof EDITABLE_FARM_FIELDS)[number];

/** Swedish label for each field, for the before/after table in the admin
 *  email — same words used elsewhere in the app (see farmBadges.ts for
 *  "Mustar din frukt", submit/route.ts's ownerEmail() for the rest). */
export const FIELD_LABELS: Record<EditableFarmField, string> = {
  name: "Gårdsnamn",
  description: "Beskrivning",
  phone: "Telefon",
  email: "E-post",
  website: "Webbplats",
  facebook: "Facebook",
  instagram: "Instagram",
  openingHours: "Öppettider",
  season: "Säsong",
  products: "Produkter",
  onSiteSales: "Gårdsförsäljning",
  tastingRoom: "Provsmakning",
  legomustning: "Mustar din frukt",
};

const BOOLEAN_FIELDS = new Set<EditableFarmField>(["onSiteSales", "tastingRoom", "legomustning"]);

/** What a single field's value looks like on the wire (JSON in `changes`,
 *  and in the POST body from the form) versus as a `farms` column. */
export type FieldValue = string | boolean | string[];

/** True when two values of the same field are the same, so the diff only
 *  ever lists what actually changed. Products compare as sets: the chip
 *  grid can reorder them without that counting as a change. */
export function fieldsEqual(field: EditableFarmField, a: FieldValue, b: FieldValue): boolean {
  if (field === "products") {
    const sa = new Set(a as string[]);
    const sb = new Set(b as string[]);
    return sa.size === sb.size && [...sa].every((v) => sb.has(v));
  }
  if (BOOLEAN_FIELDS.has(field)) return Boolean(a) === Boolean(b);
  return (a as string) === (b as string);
}

/** A field's value as the column it lands in on `farms` — booleans as 0/1,
 *  products as its stored JSON array, everything else as-is. */
export function toColumnValue(field: EditableFarmField, value: FieldValue): string | number {
  if (field === "products") return JSON.stringify(value as string[]);
  if (BOOLEAN_FIELDS.has(field)) return value ? 1 : 0;
  return value as string;
}

/** A field's value as one line of human-readable text, for the diff shown
 *  in the admin email and the /atgard confirmation page. */
export function formatFieldValue(field: EditableFarmField, value: FieldValue): string {
  if (field === "products") return (value as string[]).join(", ") || "–";
  if (BOOLEAN_FIELDS.has(field)) return value ? "Ja" : "Nej";
  return (value as string).trim() || "–";
}
