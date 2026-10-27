import type { PriceState, ShoeLabel } from "../types";

export const MAX_FEATURE_LENGTH = 32;

export interface ShoeValidation {
  valid: boolean;
  errors: string[];
  fields: Partial<Record<"model" | "regularPrice" | "salePrice" | "features" | "quantity", string>>;
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
