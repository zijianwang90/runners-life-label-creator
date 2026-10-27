import { brandNames } from "../assets";
import type { ShoeLabel } from "../types";
import { MAX_FEATURE_LENGTH } from "../utils/labels";
import { categoryText, resolveCategory } from "./categories";
import { buildShoeRefs } from "./prompt";

export type Confidence = "high" | "medium" | "low";

export interface SellingPointRow {
  shoeId: string;
  /** Type, drop, midsole foam — the same slot order the prompt asks for. Blank when the AI had no answer. */
  features: [string, string, string];
  confidence: Confidence;
  notes: string;
  /** How the reply entry was tied to a label. */
  matchedBy: "ref" | "name";
}

export interface ParseOutcome {
  rows: SellingPointRow[];
  /** Reply entries that did not match any label. */
  unmatched: string[];
  /** Labels the caller expected an answer for but the reply did not contain. */
  notReturned: ShoeLabel[];
  /** Set when nothing usable could be read; the message is shown to the user. */
  error: string | null;
}

// ---------------------------------------------------------------- reading the JSON out of a chat reply

function repairJson(text: string): string {
  return text
    .replace(/[“”„‟]/g, '"')
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1");
}

function tryParse(candidate: string): unknown {
  for (const attempt of [candidate, repairJson(candidate)]) {
    try { return JSON.parse(attempt); } catch { /* try the next repair */ }
  }
  return undefined;
}

function candidatesFrom(reply: string): string[] {
  const found: string[] = [];
  for (const match of reply.matchAll(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/g)) found.push(match[1].trim());
  found.push(reply.trim());
  const braces: Array<[string, string]> = [["{", "}"], ["[", "]"]];
  for (const [open, close] of braces) {
    const start = reply.indexOf(open);
    const end = reply.lastIndexOf(close);
    if (start >= 0 && end > start) found.push(reply.slice(start, end + 1));
  }
  return found.filter(Boolean);
}

type RawItem = Record<string, unknown>;
const isRecord = (value: unknown): value is RawItem => typeof value === "object" && value !== null && !Array.isArray(value);
const LIST_KEYS = ["labels", "shoes", "items", "results", "products", "data"];
const LOOKS_LIKE_ITEM = ["ref", "model", "category", "foam", "highlight", "dropmm", "drop"];

const keyOf = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");

function findItems(value: unknown, depth = 0): RawItem[] | null {
  if (Array.isArray(value)) {
    const items = value.filter(isRecord);
    return items.length > 0 ? items : null;
  }
  if (!isRecord(value) || depth > 2) return null;
  const entries = Object.entries(value);
  for (const wanted of LIST_KEYS) {
    const hit = entries.find(([key]) => keyOf(key) === wanted);
    const items = hit ? findItems(hit[1], depth + 1) : null;
    if (items) return items;
  }
  if (entries.some(([key]) => LOOKS_LIKE_ITEM.includes(keyOf(key)))) return [value];
  for (const [, nested] of entries) {
    const items = findItems(nested, depth + 1);
    if (items) return items;
  }
  return null;
}

export function extractReplyItems(reply: string): RawItem[] | null {
  for (const candidate of candidatesFrom(reply)) {
    const items = findItems(tryParse(candidate));
    if (items) return items;
  }
  return null;
}

// ---------------------------------------------------------------- turning an entry into three selling points

/** First value whose key matches one of `names`, trying the names in the order given. */
const pick = (item: RawItem, ...names: string[]): unknown => {
  const entries = Object.entries(item);
  for (const name of names) {
    const hit = entries.find(([key]) => keyOf(key) === keyOf(name));
    if (hit) return hit[1];
  }
  return undefined;
};

// Third selling point: the midsole foam. `highlight` and friends are the older wording of this field.
const FOAM_KEYS = ["foam", "midsoleFoam", "foamTechnology", "foamTech", "midsole", "cushioning", "highlight", "keyFeature", "feature", "hook", "sellingPoint", "callout"];

const text = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").replace(/[.;,]+$/, "").trim();
};

/** The drop in mm, or null when absent, unknown or implausible (outside 0–20 mm). */
export function parseDrop(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 && raw <= 20 ? Math.round(raw * 10) / 10 : null;
  if (typeof raw !== "string") return null;
  if (/zero/i.test(raw)) return 0;
  const match = raw.replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? parseDrop(Number(match[0])) : null;
}

export function dropText(dropMm: number | null): string {
  if (dropMm === null) return "";
  if (dropMm === 0) return "Zero drop";
  return `${Math.round(dropMm * 10) / 10}mm drop`;
}

const CONFIDENCES: Confidence[] = ["high", "medium", "low"];
const readConfidence = (raw: unknown): Confidence => {
  const value = text(raw).toLowerCase();
  return CONFIDENCES.find((level) => value.startsWith(level)) ?? "medium";
};

export function composeFeatures(item: RawItem): [string, string, string] {
  const direct = pick(item, "sellingPoints", "points", "features");
  const directList = Array.isArray(direct) ? direct.map(text) : [];
  const hasStructured = [pick(item, "category", "type", "shoeType"), pick(item, "dropMm", "drop"), pick(item, ...FOAM_KEYS)].some((value) => value !== undefined);
  if (directList.length > 0 && !hasStructured) return [directList[0] ?? "", directList[1] ?? "", directList[2] ?? ""];

  const rawCategory = pick(item, "category", "type", "shoeType", "class");
  const id = resolveCategory(rawCategory);
  const freeText = text(pick(item, "categoryText", "typeLabel", "typeText", "label"));
  const type = id && id !== "other" ? categoryText(id) : freeText || (id === null ? text(rawCategory) : "");

  const foam = text(pick(item, ...FOAM_KEYS));
  return [type, dropText(parseDrop(pick(item, "dropMm", "drop", "heelDrop", "heelToeDrop"))), foam];
}

// ---------------------------------------------------------------- matching entries to labels

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function matchByName(brand: string, model: string, shoes: ShoeLabel[]): ShoeLabel | null {
  const wantedModel = squash(model);
  if (!wantedModel) return null;
  const sameModel = shoes.filter((shoe) => squash(shoe.model) === wantedModel);
  if (sameModel.length <= 1) return sameModel[0] ?? null;
  const wantedBrand = squash(brand);
  const sameBrand = sameModel.filter((shoe) => {
    const name = squash(brandNames[shoe.brand]);
    return wantedBrand !== "" && (name === wantedBrand || name.includes(wantedBrand) || wantedBrand.includes(name));
  });
  return sameBrand.length === 1 ? sameBrand[0] : null;
}

function matchByRef(ref: string, shoes: ShoeLabel[], refs: Map<string, string>): ShoeLabel | null {
  const wanted = squash(ref);
  if (!wanted) return null;
  const exact = shoes.find((shoe) => squash(refs.get(shoe.id) ?? "") === wanted);
  if (exact) return exact;
  if (wanted.length < 6) return null;
  const byPrefix = shoes.filter((shoe) => squash(shoe.id).startsWith(wanted));
  return byPrefix.length === 1 ? byPrefix[0] : null;
}

const describeItem = (item: RawItem) => {
  const brand = text(pick(item, "brand"));
  const model = text(pick(item, "model", "name", "shoe"));
  return [brand, model].filter(Boolean).join(" ") || text(pick(item, "ref", "id")) || "(unnamed entry)";
};

export const EMPTY_FEATURES: [string, string, string] = ["", "", ""];

/**
 * Reads an AI tool's reply. Tolerant of chatter around the JSON, a missing code fence, smart quotes,
 * trailing commas and slightly different field names. `allShoes` is searched for matches; `expected`
 * (usually the labels the prompt was written for) is only used to report entries the reply left out.
 */
export function parseSellingPointsReply(reply: string, allShoes: ShoeLabel[], expected: ShoeLabel[] = []): ParseOutcome {
  const empty: ParseOutcome = { rows: [], unmatched: [], notReturned: [], error: null };
  if (!reply.trim()) return empty;

  const items = extractReplyItems(reply);
  if (!items) {
    return { ...empty, error: "No JSON found in the reply. Ask the AI tool to answer with one json code block, or paste the whole reply again." };
  }

  const refs = buildShoeRefs(allShoes);
  const rows: SellingPointRow[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const byRef = matchByRef(text(pick(item, "ref", "id", "key", "shoeId", "code")), allShoes, refs);
    const shoe = byRef ?? matchByName(text(pick(item, "brand")), text(pick(item, "model", "name", "shoe")), allShoes);
    if (!shoe || seen.has(shoe.id)) {
      unmatched.push(shoe ? `${describeItem(item)} (listed twice)` : describeItem(item));
      continue;
    }
    seen.add(shoe.id);
    rows.push({
      shoeId: shoe.id,
      features: composeFeatures(item),
      confidence: readConfidence(pick(item, "confidence")),
      notes: text(pick(item, "notes", "note", "comment", "source")),
      matchedBy: byRef ? "ref" : "name"
    });
  }

  const notReturned = expected.filter((shoe) => !seen.has(shoe.id));
  if (rows.length === 0) {
    return { rows, unmatched, notReturned, error: "None of the entries in the reply match your labels. Make sure the reply is for the prompt generated here." };
  }
  return { rows, unmatched, notReturned, error: null };
}

export const featureTooLong = (feature: string) => feature.trim().length > MAX_FEATURE_LENGTH;
