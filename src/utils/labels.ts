import { PLATE_TYPES, type PlateType, type PriceState, type ShoeLabel, type ShoeSpecs } from "../types";

export const MAX_FEATURE_LENGTH = 32;
/** The summary line shares the text area's full width, so it can run much longer than a selling point. */
export const MAX_SUMMARY_LENGTH = 60;

export const EMPTY_SPECS: ShoeSpecs = { heelStackMm: null, forefootStackMm: null, weightG: null, plate: "" };
/** Plausible ranges; values outside them are almost certainly typos (or ounces typed as grams). */
export const STACK_RANGE_MM = { min: 0, max: 60 } as const;
export const WEIGHT_RANGE_G = { min: 100, max: 500 } as const;

export const PLATE_NAMES: Record<Exclude<PlateType, "">, string> = {
  carbon: "Carbon plate",
  nylon: "Nylon plate",
  tpu: "TPU plate",
  pebax: "Pebax plate"
};

const specNumber = (value: unknown, digits: number): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10 ** digits) / 10 ** digits : null;
};

export function normalizeSpecs(input: unknown): ShoeSpecs {
  if (!input || typeof input !== "object") return { ...EMPTY_SPECS };
  const raw = input as Partial<Record<keyof ShoeSpecs, unknown>>;
  return {
    heelStackMm: specNumber(raw.heelStackMm, 1),
    forefootStackMm: specNumber(raw.forefootStackMm, 1),
    weightG: specNumber(raw.weightG, 0),
    plate: PLATE_TYPES.includes(raw.plate as Exclude<PlateType, "">) ? (raw.plate as PlateType) : ""
  };
}

const mm = (value: number) => String(Math.round(value * 10) / 10);

/** The spec row as the label prints it, one entry per filled-in spec; empty when there is nothing to show. */
export function specSegments(specs: ShoeSpecs | undefined): string[] {
  if (!specs) return [];
  const { heelStackMm: heel, forefootStackMm: forefoot, weightG, plate } = specs;
  const segments: string[] = [];
  if (heel !== null && forefoot !== null) segments.push(`Stack ${mm(heel)}/${mm(forefoot)} mm`);
  else if (heel !== null) segments.push(`Heel stack ${mm(heel)} mm`);
  else if (forefoot !== null) segments.push(`Forefoot stack ${mm(forefoot)} mm`);
  if (weightG !== null) segments.push(`${Math.round(weightG)} g`);
  if (plate) segments.push(PLATE_NAMES[plate]);
  return segments;
}

export interface ShoeValidation {
  valid: boolean;
  errors: string[];
  fields: Partial<Record<"model" | "regularPrice" | "salePrice" | "features" | "summary" | "specs" | "quantity", string>>;
}

export function getPriceState(shoe: ShoeLabel): PriceState {
  return shoe.salePrice !== null && shoe.regularPrice !== null && shoe.salePrice > 0 && shoe.salePrice < shoe.regularPrice
    ? "sale"
    : "regular";
}

export function formatMoney(value: number | null, currencySymbol = "$"): string {
  if (value === null || !Number.isFinite(value)) return `${currencySymbol}—`;
  return `${currencySymbol}${value.toFixed(2)}`;
}

export interface MoneyParts {
  whole: string;
  cents: string;
}

export function moneyParts(value: number | null): MoneyParts {
  if (value === null || !Number.isFinite(value)) return { whole: "—", cents: "" };
  const [whole, cents] = value.toFixed(2).split(".");
  return { whole, cents: `.${cents}` };
}

export function savingsAmount(shoe: ShoeLabel): number {
  if (getPriceState(shoe) !== "sale" || shoe.regularPrice === null || shoe.salePrice === null) return 0;
  return Math.max(0, shoe.regularPrice - shoe.salePrice);
}

/** Discount of the sale price off the regular price, in percent with at most one decimal; null without both prices. */
export function salePercentOf(regularPrice: number | null, salePrice: number | null): number | null {
  if (regularPrice === null || salePrice === null || !(regularPrice > 0) || !Number.isFinite(salePrice)) return null;
  return Math.round((1 - salePrice / regularPrice) * 1000) / 10;
}

/** The sale price for a discount in percent off the regular price, rounded to the cent. */
export function salePriceFromPercent(regularPrice: number, percent: number): number {
  return Math.round(regularPrice * (100 - percent)) / 100;
}

export function validateShoe(shoe: ShoeLabel): ShoeValidation {
  const errors: string[] = [];
  const fields: ShoeValidation["fields"] = {};
  const model = shoe.model.trim();
  if (!model) fields.model = "Model is required.";
  else if (model.length > 34) fields.model = "Use 34 characters or fewer.";

  if (shoe.regularPrice === null || !Number.isFinite(shoe.regularPrice) || shoe.regularPrice <= 0) {
    fields.regularPrice = "Enter a price greater than zero.";
  }
  if (shoe.salePrice !== null) {
    if (!Number.isFinite(shoe.salePrice) || shoe.salePrice <= 0) fields.salePrice = "Sale price must be greater than zero.";
    else if (shoe.regularPrice !== null && shoe.salePrice >= shoe.regularPrice) fields.salePrice = "Sale price must be lower than regular price.";
  }

  const filledFeatures = shoe.features.map((feature) => feature.trim()).filter(Boolean);
  if (filledFeatures.some((feature) => feature.length > MAX_FEATURE_LENGTH)) fields.features = `Keep each selling point to ${MAX_FEATURE_LENGTH} characters or fewer.`;

  if ((shoe.summary ?? "").trim().length > MAX_SUMMARY_LENGTH) fields.summary = `Keep the summary to ${MAX_SUMMARY_LENGTH} characters or fewer.`;

  const { heelStackMm, forefootStackMm, weightG } = shoe.specs ?? EMPTY_SPECS;
  const outOfRange = (value: number | null, range: { min: number; max: number }) => value !== null && (value < range.min || value > range.max);
  if (outOfRange(heelStackMm, STACK_RANGE_MM) || outOfRange(forefootStackMm, STACK_RANGE_MM)) {
    fields.specs = `Stack heights are ${STACK_RANGE_MM.min}–${STACK_RANGE_MM.max} mm.`;
  } else if (outOfRange(weightG, WEIGHT_RANGE_G)) {
    fields.specs = `Weight is in grams (${WEIGHT_RANGE_G.min}–${WEIGHT_RANGE_G.max} g).`;
  }

  if (!Number.isInteger(shoe.quantity) || shoe.quantity < 1 || shoe.quantity > 99) fields.quantity = "Quantity must be between 1 and 99.";
  errors.push(...Object.values(fields).filter((message): message is string => Boolean(message)));
  return { valid: errors.length === 0, errors, fields };
}

export function expandLabelCopies(shoes: ShoeLabel[]): ShoeLabel[] {
  return shoes.flatMap((shoe) => Array.from({ length: Math.max(1, shoe.quantity) }, () => shoe));
}

export function paginate<T>(items: T[], pageSize: number): T[][] {
  if (pageSize <= 0) throw new Error("pageSize must be greater than zero");
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += pageSize) pages.push(items.slice(index, index + pageSize));
  return pages;
}

export function modelFontSize(model: string): number {
  const length = model.trim().length;
  if (length <= 20) return 58;
  if (length <= 26) return 52;
  return 46;
}

export function featureFontSize(feature: string): number {
  const length = feature.trim().length;
  if (length <= 23) return 21;
  if (length <= 28) return 19;
  return 17;
}
