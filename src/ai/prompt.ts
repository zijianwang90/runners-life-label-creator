import { brandNames } from "../assets";
import type { ShoeLabel } from "../types";
import { MAX_FEATURE_LENGTH } from "../utils/labels";
import { CATEGORY_IDS, SHOE_CATEGORIES } from "./categories";

export const SELLING_POINTS_SCHEMA = "runnerslife.selling-points.v1";
/** Longest foam name the prompt asks for; the label font shrinks past ~23 characters, so shorter reads better. */
export const FOAM_TARGET_LENGTH = 24;

const normalizeId = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * A short, stable code per shoe that the AI copies back, so replies can be matched to labels even if
 * a model name is reworded. Computed over *all* shoes so a code means the same thing at import time.
 */
export function buildShoeRefs(shoes: ShoeLabel[]): Map<string, string> {
  const ids = shoes.map((shoe) => normalizeId(shoe.id));
  let length = 8;
  const longest = Math.max(8, ...ids.map((id) => id.length));
  while (length < longest && new Set(ids.map((id) => id.slice(0, length))).size < ids.length) length += 1;
  return new Map(shoes.map((shoe, index) => [shoe.id, ids[index].slice(0, length) || `shoe${index + 1}`]));
}

const shoeLine = (shoe: ShoeLabel, ref: string) =>
  `- ref: ${ref} | ${brandNames[shoe.brand]} | ${shoe.model.trim() || "(model name missing)"}`;

const categoryList = SHOE_CATEGORIES.map((category) => `   - ${category.id}: ${category.meaning}`).join("\n");

const EXAMPLE = `{
  "schema": "${SELLING_POINTS_SCHEMA}",
  "labels": [
    {
      "ref": "example1",
      "brand": "Brand",
      "model": "Example Shoe 3",
      "category": "race",
      "categoryText": "",
      "dropMm": 8,
      "foam": "PWRRUN PB",
      "heelStackMm": 36,
      "forefootStackMm": 28,
      "weightG": 233,
      "plate": "nylon",
      "confidence": "high",
      "notes": "Drop and foam name taken from the brand's product page."
    }
  ]
}`;

/**
 * The text the user pastes into any AI tool. It asks for three selling points per shoe — type, drop and
 * midsole foam — plus the specs row (stack, weight, plate), and for a single JSON block back, which
 * `parseSellingPointsReply` reads.
 */
export function buildSellingPointsPrompt(shoes: ShoeLabel[], allShoes: ShoeLabel[] = shoes): string {
  const refs = buildShoeRefs(allShoes);
  const list = shoes.map((shoe) => shoeLine(shoe, refs.get(shoe.id) ?? shoe.id)).join("\n");

  return `You are a product specialist at a running-shoe store. I am printing shelf labels and need exactly three short selling points and a few specs (stack height, weight, plate) for each running shoe listed below.

SHOES (${shoes.length})
${list}

THE THREE SELLING POINTS
1. Shoe type — field "category". Choose exactly one id:
${categoryList}
2. Heel-to-toe drop — field "dropMm". The official drop in millimetres as a plain number (for example 8, 4.5, or 0 for a zero-drop shoe). Use null if you cannot determine it reliably.
3. Midsole foam — field "foam". The name of the shoe's main midsole foam / cushioning technology, exactly as the brand names it. Examples of the style: "PWRRUN PB", "FF Blast Plus Eco", "DNA Loft v3", "Fresh Foam X". If the shoe uses two foams, give both as "Name + Name". If the brand gives the foam no name, state the material plainly ("EVA foam"). This must be a factual product name, not a description: no adjectives and no marketing wording such as "soft", "responsive", "high-rebound" or "premium". At most ${FOAM_TARGET_LENGTH} characters. Use "" if you cannot determine it reliably.

THE SPECS
4. Stack height — fields "heelStackMm" and "forefootStackMm". The official midsole stack height at the heel and at the forefoot in millimetres, as plain numbers (for example 39 and 31). The heel minus the forefoot should equal the drop. Use null for either one you cannot determine reliably.
5. Weight — field "weightG". The official weight of one shoe in grams as a plain number, for the brand's reference size (usually men's US 9). Convert ounces to grams. Use null if you cannot determine it reliably.
6. Plate — field "plate". One of: "carbon" (carbon-fibre plate), "nylon" (nylon or other non-carbon composite plate), "tpu" (TPU plate or shank), "pebax" (Pebax / PEBA plate), "none" (the shoe has no plate). Use null if you are not sure.

ACCURACY RULES
- Use the manufacturer's official specifications for the exact model and version named (a "Speed 5" is not a "Speed 4"). If you can browse the web, check the official product page first.
- Never invent a spec. If you are not sure, use null for dropMm, the stack heights, weightG or plate, say why in "notes" and set "confidence" to "low". If you do not recognise a shoe at all, still return its entry with category "other", categoryText "", dropMm null, foam "", heelStackMm null, forefootStackMm null, weightG null, plate null and confidence "low".
- "confidence": "high" = confirmed against an official spec or certain, "medium" = fairly sure, "low" = a guess or an unrecognised shoe.
- Write in English. Plain text only: no emoji, no ALL CAPS, no trailing punctuation.

OUTPUT FORMAT
Reply with ONE json code block and nothing else: no introduction, no explanation, no text before or after the block. Include exactly one entry per shoe, in the same order as the list above, and copy every "ref" unchanged. Use this structure (the example only shows the format; do not include it):

\`\`\`json
${EXAMPLE}
\`\`\`

Field rules:
- category: one of ${CATEGORY_IDS.join(" | ")}
- categoryText: only when category is "other", a 2-3 word shoe type of at most 24 characters; otherwise ""
- dropMm: a number or null (no units, no text)
- foam: the foam name only, at most ${FOAM_TARGET_LENGTH} characters (hard limit ${MAX_FEATURE_LENGTH}); "" if unknown
- heelStackMm, forefootStackMm: numbers in mm or null (no units, no text)
- weightG: a number in grams or null (no units, no text)
- plate: "carbon" | "nylon" | "tpu" | "pebax" | "none", or null if unknown
- confidence: "high", "medium" or "low"
- notes: one short sentence (at most 120 characters), or "" if there is nothing to add
`;
}
