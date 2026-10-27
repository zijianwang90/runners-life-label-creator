import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultData, normalizeAppData } from "./data";

describe("label backup normalization", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "generated-id" });
  });

  it("creates one editable row for a fresh workspace", () => {
    const data = createDefaultData();
    expect(data.version).toBe(1);
    expect(data.shoes).toHaveLength(1);
    expect(data.settings.printMode).toBe("a4");
  });

  it("clamps imported quantities and calibration values", () => {
    const data = normalizeAppData({
      shoes: [{ brand: "unknown", model: 123, quantity: 500, features: ["A", "B"] }],
      settings: {
        currencySymbol: "CAD$",
        printMode: "custom",
        useSystemDialog: false,
        calibration: { scaleX: 3, scaleY: 0.1, offsetXmm: 20, offsetYmm: -20 }
      }
    });
    expect(data.shoes[0].brand).toBe("saucony");
    expect(data.shoes[0].model).toBe("123");
    expect(data.shoes[0].quantity).toBe(99);
    expect(data.settings.currencySymbol).toBe("CAD");
    expect(data.settings.calibration).toEqual({ scaleX: 1.05, scaleY: 0.95, offsetXmm: 5, offsetYmm: -5 });
  });

  it("gives data saved before label sizes existed the approved 220 × 23 mm", () => {
    const data = normalizeAppData({ shoes: [{ model: "Old label" }], settings: { currencySymbol: "$", printMode: "a4" } });
    expect(data.settings.labelSize).toEqual({ widthMm: 220, heightMm: 23 });
    expect(createDefaultData().settings.labelSize).toEqual({ widthMm: 220, heightMm: 23 });
  });

  it("keeps a saved label size and pulls an invalid one back into range", () => {
    expect(normalizeAppData({ shoes: [], settings: { labelSize: { widthMm: 240, heightMm: 28 } } }).settings.labelSize).toEqual({ widthMm: 240, heightMm: 28 });
    const clamped = normalizeAppData({ shoes: [], settings: { labelSize: { widthMm: 9000, heightMm: 1 } } }).settings.labelSize;
    expect(clamped.widthMm).toBeLessThanOrEqual(280);
    expect(clamped.heightMm).toBeGreaterThanOrEqual(15);
  });

  it("rejects files without a shoe list", () => {
    expect(() => normalizeAppData({})).toThrow(/shoe list/);
  });
});
