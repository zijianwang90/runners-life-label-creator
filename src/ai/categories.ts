/**
 * Selling point 1 is always the shoe type. The AI picks an id from this list and the app turns it into
 * the label wording, so every label on the wall uses the same phrase for the same kind of shoe.
 */
export const SHOE_CATEGORIES = [
  { id: "race", text: "Race day", meaning: "built for racing: carbon plate and/or super-light, high-rebound foam" },
  { id: "speed", text: "Speed trainer", meaning: "light, responsive shoe for tempo runs, intervals and fast days (not a pure racer)" },
  { id: "neutral", text: "Neutral daily trainer", meaning: "everyday trainer with no stability elements, for runners who need no extra support" },
  { id: "stability", text: "Stability support", meaning: "extra support for overpronation: guide rails, medial post, wide base" },
  { id: "max-cushion", text: "Max cushion", meaning: "maximum-cushioned shoe for recovery days and long, slow miles" },
  { id: "trail", text: "Trail running", meaning: "lugged outsole and protection for off-road running" },
  { id: "other", text: "", meaning: "none of the above (hiking, walking, track spikes, lifestyle...); describe it in categoryText" }
] as const;

export type ShoeCategoryId = (typeof SHOE_CATEGORIES)[number]["id"];

export const CATEGORY_IDS = SHOE_CATEGORIES.map((category) => category.id);

const squash = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

// Words an AI tool tends to use instead of the exact id; checked in this order.
const CATEGORY_HINTS: Array<[Exclude<ShoeCategoryId, "other">, string[]]> = [
  ["race", ["race", "racing", "racer", "competition", "supershoe"]],
  ["trail", ["trail", "offroad"]],
  ["stability", ["stability", "stable", "support", "motioncontrol", "overpronation", "guidance"]],
  ["max-cushion", ["maxcushion", "cushion", "plush", "recovery"]],
  ["speed", ["speed", "tempo", "uptempo", "fasttrainer", "performancetrainer"]],
  ["neutral", ["neutral", "daily", "everyday"]]
];

/** Maps whatever the AI wrote for "category" to one of our ids, or null when it means something else. */
export function resolveCategory(raw: unknown): ShoeCategoryId | null {
  if (typeof raw !== "string") return null;
  const key = squash(raw);
  if (!key) return null;
  if (key === "other") return "other";
  for (const [id, hints] of CATEGORY_HINTS) {
    if (hints.some((hint) => key === hint || key.includes(hint))) return id;
  }
  return null;
}

export const categoryText = (id: ShoeCategoryId): string => SHOE_CATEGORIES.find((category) => category.id === id)?.text ?? "";
