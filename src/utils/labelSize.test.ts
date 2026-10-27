import { describe, expect, it } from "vitest";
import {
  a4Layout,
  changeLabelSize,
  clampFeatureScale,
  clampLabelSize,
  clampTextScale,
  DEFAULT_LABEL_SIZE,
  FEATURE_TEXT_SCALE,
  featureTextPrintSize,
  formatLabelSize,
  LABEL_SIZE_LIMITS,
  labelSizeRanges,
  percentToScale,
  scaleToPercent,
  textPrintSize
} from "./labelSize";

const aspect = (size: { widthMm: number; heightMm: number }) => size.widthMm / size.heightMm;

describe("label size limits", () => {
  it("keeps the approved 220 × 23 mm label valid and unchanged", () => {
    expect(clampLabelSize(DEFAULT_LABEL_SIZE)).toEqual({ widthMm: 220, heightMm: 23 });
    expect(aspect(DEFAULT_LABEL_SIZE)).toBeGreaterThan(LABEL_SIZE_LIMITS.aspect.min);
    expect(aspect(DEFAULT_LABEL_SIZE)).toBeLessThan(LABEL_SIZE_LIMITS.aspect.max);
  });

  it("falls back to the default for missing or non-numeric input", () => {
    expect(clampLabelSize(undefined)).toEqual(DEFAULT_LABEL_SIZE);
    expect(clampLabelSize({ widthMm: "wide", heightMm: -4 })).toEqual(DEFAULT_LABEL_SIZE);
    expect(clampLabelSize({ widthMm: NaN, heightMm: null })).toEqual(DEFAULT_LABEL_SIZE);
  });

  it("clamps each dimension to its own limits", () => {
    expect(clampLabelSize({ widthMm: 9999, heightMm: 23 }).widthMm).toBe(LABEL_SIZE_LIMITS.widthMm.max);
    expect(clampLabelSize({ widthMm: 5, heightMm: 15 }, "widthMm").widthMm).toBe(LABEL_SIZE_LIMITS.widthMm.min);
    expect(clampLabelSize({ widthMm: 280, heightMm: 500 }, "heightMm").heightMm).toBe(LABEL_SIZE_LIMITS.heightMm.max);
    expect(clampLabelSize({ widthMm: 280, heightMm: 1 }, "heightMm").heightMm).toBeGreaterThanOrEqual(LABEL_SIZE_LIMITS.heightMm.min);
  });

  it("moves the other dimension when the aspect ratio would break", () => {
    // 160 × 30 mm is 5.3:1, too square to lay out. If the height is what the user chose, the width grows...
    expect(clampLabelSize({ widthMm: 160, heightMm: 30 }, "heightMm")).toEqual({ widthMm: 180, heightMm: 30 });
    // ...and if the width is what they chose, the height gives way instead.
    expect(clampLabelSize({ widthMm: 160, heightMm: 30 }, "widthMm")).toEqual({ widthMm: 160, heightMm: 26.6 });
    // 180 × 30 mm, 6:1, is the squarest label allowed.
    expect(clampLabelSize({ widthMm: 180, heightMm: 30 }, "heightMm")).toEqual({ widthMm: 180, heightMm: 30 });
  });

  it("allows the whole range that was asked for where the shape is valid", () => {
    expect(clampLabelSize({ widthMm: 160, heightMm: 23 })).toEqual({ widthMm: 160, heightMm: 23 });
    expect(clampLabelSize({ widthMm: 240, heightMm: 23 })).toEqual({ widthMm: 240, heightMm: 23 });
    expect(clampLabelSize({ widthMm: 240, heightMm: 30 })).toEqual({ widthMm: 240, heightMm: 30 });
    expect(LABEL_SIZE_LIMITS.widthMm).toEqual({ min: 160, max: 240 });
    expect(LABEL_SIZE_LIMITS.heightMm).toEqual({ min: 23, max: 30 });
  });

  it("always returns an in-range size for any combination", () => {
    for (let width = 100; width <= 320; width += 7) {
      for (let height = 10; height <= 40; height += 3) {
        for (const anchor of ["widthMm", "heightMm"] as const) {
          const size = clampLabelSize({ widthMm: width, heightMm: height }, anchor);
          expect(size.widthMm).toBeGreaterThanOrEqual(LABEL_SIZE_LIMITS.widthMm.min);
          expect(size.widthMm).toBeLessThanOrEqual(LABEL_SIZE_LIMITS.widthMm.max);
          expect(size.heightMm).toBeGreaterThanOrEqual(LABEL_SIZE_LIMITS.heightMm.min);
          expect(size.heightMm).toBeLessThanOrEqual(LABEL_SIZE_LIMITS.heightMm.max);
          expect(aspect(size)).toBeGreaterThanOrEqual(LABEL_SIZE_LIMITS.aspect.min - 0.05);
          expect(aspect(size)).toBeLessThanOrEqual(LABEL_SIZE_LIMITS.aspect.max + 0.05);
        }
      }
    }
  });

  it("reports the range each dimension may take given the other", () => {
    // The approved size sits well inside the shape limits, so nothing is held back.
    expect(labelSizeRanges(DEFAULT_LABEL_SIZE)).toEqual({ widthMm: { min: 160, max: 240 }, heightMm: { min: 23, max: 30 } });
    // Narrow labels cannot be tall, and tall labels cannot be narrow.
    expect(labelSizeRanges({ widthMm: 160, heightMm: 23 }).heightMm).toEqual({ min: 23, max: 26.6 });
    expect(labelSizeRanges({ widthMm: 240, heightMm: 30 }).widthMm).toEqual({ min: 180, max: 240 });
  });

  it("formats sizes without trailing zeros", () => {
    expect(formatLabelSize({ widthMm: 220, heightMm: 22.5 })).toBe("220 × 22.5 mm");
  });
});

describe("editing one dimension", () => {
  it("changes only that dimension when the shape stays valid", () => {
    expect(changeLabelSize({ widthMm: 220, heightMm: 23 }, "widthMm", 240)).toEqual({ size: { widthMm: 240, heightMm: 23 }, adjusted: null });
    expect(changeLabelSize({ widthMm: 220, heightMm: 23 }, "heightMm", 25)).toEqual({ size: { widthMm: 220, heightMm: 25 }, adjusted: null });
  });

  it("keeps what was typed and adjusts the other dimension when the aspect ratio would break", () => {
    // 170 mm wide cannot be 30 mm tall (5.7:1): the height gives way.
    expect(changeLabelSize({ widthMm: 200, heightMm: 30 }, "widthMm", 170)).toEqual({ size: { widthMm: 170, heightMm: 28.3 }, adjusted: "heightMm" });
    // 30 mm tall needs at least 180 mm of width.
    expect(changeLabelSize({ widthMm: 170, heightMm: 25 }, "heightMm", 30)).toEqual({ size: { widthMm: 180, heightMm: 30 }, adjusted: "widthMm" });
  });

  it("applies the fixed limits to the edited value first", () => {
    // 150 mm is below the 160 mm minimum: it becomes 160, and the height follows from that.
    expect(changeLabelSize({ widthMm: 200, heightMm: 28 }, "widthMm", 150)).toEqual({ size: { widthMm: 160, heightMm: 26.6 }, adjusted: "heightMm" });
  });

  it("does not report an adjustment when the other value is already right", () => {
    expect(changeLabelSize({ widthMm: 200, heightMm: 25 }, "widthMm", 200).adjusted).toBeNull();
    expect(changeLabelSize({ widthMm: 200, heightMm: 25 }, "widthMm", 240).adjusted).toBeNull();
  });
});

describe("selling point text scale", () => {
  it("defaults to the shop standard (150% of the approved design) and clamps to 60–130% of it", () => {
    expect(FEATURE_TEXT_SCALE.default).toBe(1.5);
    expect(clampFeatureScale(1)).toBe(1);
    expect(clampFeatureScale(1.35)).toBe(1.35);
    expect(clampFeatureScale(5)).toBe(1.95);
    expect(clampFeatureScale(0.2)).toBe(0.9);
  });

  it("falls back to the shop standard for anything that is not a usable number", () => {
    for (const bad of [undefined, null, "big", NaN, 0, -1, Infinity]) expect(clampFeatureScale(bad)).toBe(1.5);
  });

  it("converts the scale to the size the text prints at", () => {
    // The approved text is 21 units of a 230-unit-tall label: 2.1 mm on a 23 mm label.
    expect(featureTextPrintSize(1, 23).mm).toBeCloseTo(2.1, 5);
    expect(featureTextPrintSize(1, 23).pt).toBeCloseTo(5.95, 1);
    expect(featureTextPrintSize(1.5, 23).pt).toBeCloseTo(8.93, 1);
    // A taller label prints the same scale larger.
    expect(featureTextPrintSize(1, 30).mm).toBeCloseTo(2.74, 2);
  });
});

describe("model name and price text scale", () => {
  it("clamps each to its own range", () => {
    expect(clampTextScale("model", 1.2)).toBe(1.2);
    expect(clampTextScale("model", 3)).toBe(1.69);
    expect(clampTextScale("price", 3)).toBe(1.38);
    expect(clampTextScale("price", 0.1)).toBe(0.84);
    expect(clampTextScale("price", "big")).toBe(1.2);
    expect(clampTextScale("regular", 9)).toBe(1.95);
    expect(clampTextScale("seal", 9)).toBe(1.2);
  });

  it("shows sizes as a percent of the shop standard", () => {
    // The sizes the shop settled on in v1.1.1 read as 100%.
    expect([scaleToPercent("model", 1.3), scaleToPercent("feature", 1.5), scaleToPercent("price", 1.2)]).toEqual([100, 100, 100]);
    expect([scaleToPercent("model", 1), scaleToPercent("feature", 1)]).toEqual([77, 67]);
    expect(percentToScale("feature", 120)).toBe(1.8);
    expect(percentToScale("model", 95)).toBeCloseTo(1.24, 2);
    expect(scaleToPercent("model", percentToScale("model", 95))).toBe(95);
    expect(percentToScale("price", 200)).toBe(1.38);
  });

  it("converts each scale to the size it prints at", () => {
    // The approved model name is 58 units, the price 88 units, of a 230-unit-tall label.
    expect(textPrintSize("model", 1, 23).mm).toBeCloseTo(5.8, 5);
    expect(textPrintSize("price", 1, 23).mm).toBeCloseTo(8.8, 5);
    expect(textPrintSize("price", 1.25, 23).mm).toBeCloseTo(11, 5);
  });
});

describe("A4 landscape imposition", () => {
  it("reproduces the approved sheet: eight 220 × 23 mm labels, centred", () => {
    expect(a4Layout(DEFAULT_LABEL_SIZE)).toEqual({ perPage: 8, leftMm: 38.5, topMm: 13, stackHeightMm: 184 });
  });

  it("fits more short labels and fewer tall ones", () => {
    expect(a4Layout({ widthMm: 160, heightMm: 23 }).perPage).toBe(8);
    expect(a4Layout({ widthMm: 240, heightMm: 30 }).perPage).toBe(6);
  });

  it("leaves room for the crop marks beside the widest label", () => {
    const { leftMm } = a4Layout({ widthMm: LABEL_SIZE_LIMITS.widthMm.max, heightMm: 30 });
    expect(leftMm).toBeGreaterThanOrEqual(6.5);
  });
});
