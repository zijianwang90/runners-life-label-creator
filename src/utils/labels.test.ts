import { describe, expect, it } from "vitest";
import type { ShoeLabel } from "../types";
import {
  expandLabelCopies,
  featureFontSize,
  formatMoney,
  getPriceState,
  moneyParts,
  modelFontSize,
  paginate,
  salePercentOf,
  salePriceFromPercent,
  normalizeSpecs,
  savingsAmount,
  specSegments,
  validateShoe
} from "./labels";

const shoe = (patch: Partial<ShoeLabel> = {}): ShoeLabel => ({
  id: "shoe-1",
  brand: "saucony",
  model: "Endorphin Speed 5",
  regularPrice: 229.99,
  salePrice: 189.99,
  features: ["Lightweight", "Speedroll technology", "Tempo-ready"],
  specs: { heelStackMm: null, forefootStackMm: null, weightG: null, plate: "" },
  quantity: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch
});

describe("price helpers", () => {
  it("uses sale state only for a positive price lower than regular", () => {
    expect(getPriceState(shoe())).toBe("sale");
    expect(getPriceState(shoe({ salePrice: 229.99 }))).toBe("regular");
    expect(getPriceState(shoe({ salePrice: null }))).toBe("regular");
  });

  it("formats prices and calculates savings", () => {
    expect(formatMoney(12, "$ ")).toBe("$ 12.00");
    expect(formatMoney(null, "$ ")).toBe("$ —");
    expect(moneyParts(189.99)).toEqual({ whole: "189", cents: ".99" });
    expect(moneyParts(12)).toEqual({ whole: "12", cents: ".00" });
    expect(moneyParts(null)).toEqual({ whole: "—", cents: "" });
    expect(savingsAmount(shoe())).toBeCloseTo(40);
  });

  it("converts between a sale percent and a sale price", () => {
    expect(salePriceFromPercent(229.99, 20)).toBe(183.99);
    expect(salePriceFromPercent(200, 25)).toBe(150);
    expect(salePriceFromPercent(199.95, 15)).toBe(169.96);
    expect(salePercentOf(200, 150)).toBe(25);
    expect(salePercentOf(229.99, 189.99)).toBe(17.4);
    expect(salePercentOf(229.99, salePriceFromPercent(229.99, 20))).toBe(20);
    expect(salePercentOf(null, 150)).toBeNull();
    expect(salePercentOf(200, null)).toBeNull();
    expect(salePercentOf(0, 150)).toBeNull();
  });
});

describe("validation", () => {
  it("accepts a complete regular or sale label", () => {
    expect(validateShoe(shoe()).valid).toBe(true);
    expect(validateShoe(shoe({ salePrice: null })).valid).toBe(true);
  });

  it("reports required model, price, and quantity constraints", () => {
    const result = validateShoe(shoe({ model: "", regularPrice: 0, salePrice: 20, features: ["Only one", "", ""], quantity: 100 }));
    expect(result.valid).toBe(false);
    expect(result.fields.model).toBeTruthy();
    expect(result.fields.regularPrice).toBeTruthy();
    expect(result.fields.quantity).toBeTruthy();
  });

  it("allows zero selling points", () => {
    expect(validateShoe(shoe({ features: ["", "", ""] })).valid).toBe(true);
  });

  it("rejects sale prices that do not represent a discount", () => {
    expect(validateShoe(shoe({ salePrice: 230 })).fields.salePrice).toMatch(/lower/);
  });
});

describe("print layout helpers", () => {
  it("expands copies and paginates eight A4 labels per sheet", () => {
    const labels = expandLabelCopies([shoe({ quantity: 9 })]);
    expect(labels).toHaveLength(9);
    expect(paginate(labels, 8).map((page) => page.length)).toEqual([8, 1]);
  });

  it("refuses an invalid page size", () => {
    expect(() => paginate([1], 0)).toThrow();
  });

  it("reduces label typography for long content", () => {
    expect(modelFontSize("SHORT")).toBeGreaterThan(modelFontSize("A VERY LONG RUNNING SHOE MODEL"));
    expect(featureFontSize("short point")).toBeGreaterThan(featureFontSize("A rather long selling point here"));
  });
});

describe("specs", () => {
  it("prints stack as heel/forefoot, then weight and plate", () => {
    expect(specSegments({ heelStackMm: 39, forefootStackMm: 31.5, weightG: 245.4, plate: "carbon" })).toEqual(["Stack 39/31.5 mm", "245 g", "Carbon plate"]);
    expect(specSegments({ heelStackMm: 39, forefootStackMm: null, weightG: null, plate: "" })).toEqual(["Heel stack 39 mm"]);
    expect(specSegments({ heelStackMm: null, forefootStackMm: null, weightG: null, plate: "" })).toEqual([]);
    expect(specSegments(undefined)).toEqual([]);
  });

  it("cleans up saved specs", () => {
    expect(normalizeSpecs(undefined)).toEqual({ heelStackMm: null, forefootStackMm: null, weightG: null, plate: "" });
    expect(normalizeSpecs({ heelStackMm: "38.25", forefootStackMm: -3, weightG: 230.6, plate: "titanium" }))
      .toEqual({ heelStackMm: 38.3, forefootStackMm: null, weightG: 231, plate: "" });
  });

  it("flags implausible stack heights and weights", () => {
    const specs = { heelStackMm: 39, forefootStackMm: 31, weightG: 245, plate: "" as const };
    expect(validateShoe(shoe({ specs })).fields.specs).toBeUndefined();
    expect(validateShoe(shoe({ specs: { ...specs, heelStackMm: 390 } })).fields.specs).toMatch(/0–60 mm/);
    expect(validateShoe(shoe({ specs: { ...specs, weightG: 8.6 } })).fields.specs).toMatch(/grams/);
  });
});
