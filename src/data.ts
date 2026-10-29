import type { AppData, AppSettings, BrandId, ShoeLabel } from "./types";
import { BRAND_IDS } from "./types";
import { normalizeCart } from "./utils/cart";
import { EMPTY_SPECS, normalizeSpecs } from "./utils/labels";
import { clampLabelSize, clampTextScale, DEFAULT_LABEL_SIZE, TEXT_SCALE_LIMITS } from "./utils/labelSize";

export const defaultSettings: AppSettings = {
  currencySymbol: "$",
  printMode: "a4",
  labelSize: { ...DEFAULT_LABEL_SIZE },
  modelTextScale: TEXT_SCALE_LIMITS.model.default,
  featureTextScale: TEXT_SCALE_LIMITS.feature.default,
  priceTextScale: TEXT_SCALE_LIMITS.price.default,
  regularPriceTextScale: TEXT_SCALE_LIMITS.regular.default,
  saleSealScale: TEXT_SCALE_LIMITS.seal.default,
  calibration: {
    scaleX: 1,
    scaleY: 1,
    offsetXmm: 0,
    offsetYmm: 0
  }
};

export function createEmptyShoe(brand: BrandId = "saucony"): ShoeLabel {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    brand,
    model: "",
    regularPrice: null,
    salePrice: null,
    features: ["", "", ""],
    summary: "",
    specs: { ...EMPTY_SPECS },
    quantity: 1,
    createdAt: now,
    updatedAt: now
  };
}

export function createDefaultData(): AppData {
  return {
    version: 1,
    shoes: [createEmptyShoe()],
    printCart: [],
    settings: structuredClone(defaultSettings)
  };
}

const finiteNumberOrNull = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function normalizeAppData(input: unknown): AppData {
  if (!input || typeof input !== "object") throw new Error("The saved label data is not valid.");
  const candidate = input as Partial<AppData>;
  if (!Array.isArray(candidate.shoes)) throw new Error("The saved label data does not contain a shoe list.");

  const shoes = candidate.shoes.map((raw, index): ShoeLabel => {
    if (!raw || typeof raw !== "object") throw new Error(`Shoe ${index + 1} is invalid.`);
    const shoe = raw as Partial<ShoeLabel>;
    const brand = BRAND_IDS.includes(shoe.brand as BrandId) ? (shoe.brand as BrandId) : "saucony";
    const features = Array.isArray(shoe.features)
      ? [0, 1, 2].map((featureIndex) => String(shoe.features?.[featureIndex] ?? "").slice(0, 80))
      : ["", "", ""];
    const now = new Date().toISOString();
    return {
      id: typeof shoe.id === "string" && shoe.id ? shoe.id : crypto.randomUUID(),
      brand,
      model: String(shoe.model ?? "").slice(0, 100),
      regularPrice: finiteNumberOrNull(shoe.regularPrice),
      salePrice: finiteNumberOrNull(shoe.salePrice),
      features: features as [string, string, string],
      summary: typeof shoe.summary === "string" ? shoe.summary.replace(/\s+/g, " ").slice(0, 120) : "",
      specs: normalizeSpecs(shoe.specs),
      quantity: Math.min(99, Math.max(1, Math.round(Number(shoe.quantity) || 1))),
      createdAt: typeof shoe.createdAt === "string" ? shoe.createdAt : now,
      updatedAt: typeof shoe.updatedAt === "string" ? shoe.updatedAt : now
    };
  });

  const rawSettings = candidate.settings ?? defaultSettings;
  const calibration = rawSettings.calibration ?? defaultSettings.calibration;
  return {
    version: 1,
    shoes: shoes.length > 0 ? shoes : [createEmptyShoe()],
    printCart: normalizeCart(candidate.printCart, new Set(shoes.map((shoe) => shoe.id))),
    settings: {
      currencySymbol: typeof rawSettings.currencySymbol === "string" && rawSettings.currencySymbol
        ? rawSettings.currencySymbol.slice(0, 3)
        : "$",
      printMode: rawSettings.printMode === "custom" ? "custom" : "a4",
      labelSize: clampLabelSize(rawSettings.labelSize),
      modelTextScale: clampTextScale("model", rawSettings.modelTextScale),
      featureTextScale: clampTextScale("feature", rawSettings.featureTextScale),
      priceTextScale: clampTextScale("price", rawSettings.priceTextScale),
      regularPriceTextScale: clampTextScale("regular", rawSettings.regularPriceTextScale),
      saleSealScale: clampTextScale("seal", rawSettings.saleSealScale),
      calibration: {
        scaleX: Math.min(1.05, Math.max(0.95, Number(calibration.scaleX) || 1)),
        scaleY: Math.min(1.05, Math.max(0.95, Number(calibration.scaleY) || 1)),
        offsetXmm: Math.min(5, Math.max(-5, Number(calibration.offsetXmm) || 0)),
        offsetYmm: Math.min(5, Math.max(-5, Number(calibration.offsetYmm) || 0))
      }
    }
  };
}
