import { describe, expect, it } from "vitest";
import { featureFontSize, modelFontSize } from "./labels";
import {
  BASE_DESIGN_WIDTH,
  computeLabelLayout,
  designWidth,
  estimateTextWidth,
  fitText,
  GLYPH_ADVANCE_COUNTS,
  GLYPH_TABLE_SIZE
} from "./labelLayout";
import { clampLabelSize, DEFAULT_LABEL_SIZE, LABEL_SIZE_LIMITS } from "./labelSize";

describe("design canvas", () => {
  it("is exactly the approved 2200 × 230 canvas at 220 × 23 mm", () => {
    expect(designWidth(DEFAULT_LABEL_SIZE)).toBe(BASE_DESIGN_WIDTH);
  });

  it("follows the aspect ratio, not the absolute size", () => {
    expect(designWidth({ widthMm: 440, heightMm: 46 })).toBe(BASE_DESIGN_WIDTH);
    expect(designWidth({ widthMm: 250, heightMm: 23 })).toBeGreaterThan(BASE_DESIGN_WIDTH);
  });
});

describe("label layout at the approved size", () => {
  it("keeps every approved coordinate", () => {
    expect(computeLabelLayout(2200, 3)).toMatchObject({
      priceOffsetX: 0,
      model: { x: 650, y: 105, maxWidth: 950 },
      separatorXs: [979, 1293]
    });
    expect(computeLabelLayout(2200, 3).features.map((slot) => slot.x)).toEqual([653, 1007, 1321]);
    expect(computeLabelLayout(2200, 2).features.map((slot) => slot.x)).toEqual([653, 1125]);
    expect(computeLabelLayout(2200, 2).separatorXs).toEqual([1080]);
    expect(computeLabelLayout(2200, 1).features.map((slot) => slot.x)).toEqual([653]);
    expect(computeLabelLayout(2200, 0).model.y).toBe(137);
  });
});

describe("label layout at other sizes", () => {
  it("glues the price block to the right edge", () => {
    expect(computeLabelLayout(2400, 3).priceOffsetX).toBe(200);
    expect(computeLabelLayout(1900, 3).priceOffsetX).toBe(-300);
  });

  it("spreads the selling points over the room that is left, in order and clear of the price block", () => {
    for (const width of [1840, 2000, 2200, 2500, 2875]) {
      const layout = computeLabelLayout(width, 3);
      const xs = layout.features.map((slot) => slot.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      layout.features.forEach((slot) => {
        expect(slot.maxWidth).toBeGreaterThan(100);
        expect(slot.x + slot.maxWidth).toBeLessThanOrEqual(width - 540);
      });
      layout.separatorXs.forEach((separator, index) => expect(separator).toBeGreaterThan(layout.features[index].x + layout.features[index].maxWidth));
    }
  });

  it("lays out every size the editor allows", () => {
    for (let width = LABEL_SIZE_LIMITS.widthMm.min; width <= LABEL_SIZE_LIMITS.widthMm.max; width += 20) {
      for (let height = LABEL_SIZE_LIMITS.heightMm.min; height <= LABEL_SIZE_LIMITS.heightMm.max; height += 4) {
        const size = clampLabelSize({ widthMm: width, heightMm: height });
        const layout = computeLabelLayout(designWidth(size), 3);
        expect(layout.model.maxWidth).toBeGreaterThan(500);
        layout.features.forEach((slot) => expect(slot.maxWidth).toBeGreaterThan(130));
      }
    }
  });
});

describe("text measurement", () => {
  it("has an advance width for every glyph in the table", () => {
    expect(GLYPH_ADVANCE_COUNTS[600]).toBe(GLYPH_TABLE_SIZE);
    expect(GLYPH_ADVANCE_COUNTS[800]).toBe(GLYPH_TABLE_SIZE);
  });

  it("measures upper-case regardless of how the text was typed", () => {
    expect(estimateTextWidth("Speed", 20, 600)).toBe(estimateTextWidth("SPEED", 20, 600));
  });

  it("scales with the font size and applies letter spacing", () => {
    expect(estimateTextWidth("AB", 40, 800)).toBeCloseTo(2 * estimateTextWidth("AB", 20, 800));
    expect(estimateTextWidth("AB", 20, 800, -1)).toBeCloseTo(estimateTextWidth("AB", 20, 800) - 2);
  });

  it("gives CJK text a full-width advance", () => {
    expect(estimateTextWidth("跑鞋", 10, 600)).toBe(20);
  });
});

describe("text fitting", () => {
  it("never changes text that already fits, so approved labels look the same", () => {
    const model = "Endorphin Speed 5";
    const fit = fitText(model, { baseSize: modelFontSize(model), maxWidth: 950, weight: 800, letterSpacing: -1.1 });
    expect(fit).toEqual({ fontSize: 58 });

    const longest = "A".repeat(32);
    const feature = fitText(longest, { baseSize: featureFontSize(longest), maxWidth: 268, weight: 600 });
    expect(feature.textLength).toBeUndefined();
  });

  it("keeps typical approved content untouched in every slot of the 3-point layout", () => {
    const layout = computeLabelLayout(2200, 3);
    const points = ["Max cushion trainer", "8mm drop", "Carbon plate + PEBA foam"];
    points.forEach((point, index) => {
      expect(fitText(point, { baseSize: featureFontSize(point), maxWidth: layout.features[index].maxWidth, weight: 600 }))
        .toEqual({ fontSize: featureFontSize(point) });
    });
  });

  it("shrinks text that is too wide for a narrow label", () => {
    const narrow = computeLabelLayout(1840, 3).model.maxWidth;
    const model = "Endorphin Speed 5 Women's Edition";
    const fit = fitText(model, { baseSize: modelFontSize(model), maxWidth: narrow, weight: 800, letterSpacing: -1.1 });
    expect(fit.fontSize).toBeLessThan(modelFontSize(model));
    expect(estimateTextWidth(model, fit.fontSize, 800, -1.1) <= narrow || fit.textLength !== undefined).toBe(true);
  });

  it("condenses instead of overflowing once the minimum size is reached", () => {
    const fit = fitText("A very long selling point phrase", { baseSize: 17, maxWidth: 120, weight: 600 });
    expect(fit.fontSize).toBeCloseTo(17 * 0.8, 0);
    expect(fit.textLength).toBe(120);
  });

  it("leaves empty text alone", () => {
    expect(fitText("  ", { baseSize: 21, maxWidth: 10, weight: 600 })).toEqual({ fontSize: 21 });
  });
});
