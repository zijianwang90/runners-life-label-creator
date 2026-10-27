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
  savingsAmount,
  validateShoe
} from "./labels";

const shoe = (patch: Partial<ShoeLabel> = {}): ShoeLabel => ({
  id: "shoe-1",
  brand: "saucony",
  model: "Endorphin Speed 5",
  regularPrice: 229.99,
  salePrice: 189.99,
  features: ["Lightweight", "Speedroll technology", "Tempo-ready"],
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
