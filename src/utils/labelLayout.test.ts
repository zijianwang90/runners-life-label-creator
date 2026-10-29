import { describe, expect, it } from "vitest";
import { featureFontSize, modelFontSize } from "./labels";
import {
  BASE_DESIGN_WIDTH,
  computeLabelLayout,
  designWidth,
  estimateTextWidth,
  fitText,
  GLYPH_ADVANCE_COUNTS,
  GLYPH_TABLE_SIZE,
  squeezeFor
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
      squeeze: 1,
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

describe("spec row", () => {
  it("moves the model and selling points up to make room for it", () => {
    const layout = computeLabelLayout(2200, 3, true);
    expect([layout.model.y, layout.featureY, layout.specs?.y]).toEqual([92, 144, 193]);
    expect(layout.specs).toMatchObject({ x: 653, maxWidth: 997 });
    expect(computeLabelLayout(2200, 0, true)).toMatchObject({ model: { y: 117 }, specs: { y: 178 } });
  });

  it("leaves the approved layout alone when there are no specs", () => {
    expect(computeLabelLayout(2200, 3)).toMatchObject({ featureY: 162, specs: null });
  });
});

describe("summary line", () => {
  it("sits under the model name and moves the other rows to make room", () => {
    const all = computeLabelLayout(2200, 3, true, true);
    expect([all.model.y, all.summary?.y, all.featureY, all.specs?.y]).toEqual([78, 118, 159, 201]);
    expect(all.summary).toMatchObject({ x: 653, maxWidth: 997 });
    expect(computeLabelLayout(2200, 3, false, true)).toMatchObject({ model: { y: 90 }, summary: { y: 133 }, featureY: 180, specs: null });
    expect(computeLabelLayout(2200, 0, true, true)).toMatchObject({ model: { y: 92 }, summary: { y: 136 }, specs: { y: 183 } });
    expect(computeLabelLayout(2200, 0, false, true)).toMatchObject({ model: { y: 105 }, summary: { y: 160 } });
  });

  it("leaves the layout alone without a summary", () => {
    expect(computeLabelLayout(2200, 3, true)).toMatchObject({ model: { y: 92 }, featureY: 144, summary: null });
    expect(computeLabelLayout(2200, 3)).toMatchObject({ model: { y: 105 }, featureY: 162, summary: null });
  });
});

describe("narrow labels", () => {
  it("keeps the logo and price blocks at full size at the approved width and wider", () => {
    expect(squeezeFor(2200)).toBe(1);
    expect(squeezeFor(2400)).toBe(1);
    expect(computeLabelLayout(2400, 3).squeeze).toBe(1);
  });

  it("narrows them below the approved width, gradually and never to nothing", () => {
    const widths = [2100, 1900, 1700, 1600, 1495];
    const squeezes = widths.map(squeezeFor);
    expect(squeezes).toEqual([...squeezes].sort((a, b) => b - a));
    expect(squeezeFor(1600)).toBeCloseTo(0.735, 3);
    expect(Math.min(...squeezes)).toBeGreaterThan(0.68);
  });

  it("gives the text area back most of what the shorter label lost", () => {
    // At 160 × 23 mm the text area is ~77% of the approved one, not the ~44% it would be without squeezing.
    const layout = computeLabelLayout(designWidth({ widthMm: 160, heightMm: 23 }), 3);
    const textArea = layout.width - (600 + 532) * layout.squeeze;
    expect(textArea / 1068).toBeGreaterThan(0.7);
  });
});

describe("label layout at other sizes", () => {
  it("spreads the selling points over the room that is left, in order, clear of the price block", () => {
    for (const width of [1495, 1600, 1840, 2200, 2400]) {
      const layout = computeLabelLayout(width, 3);
      const priceLeft = width - 532 * layout.squeeze;
      const xs = layout.features.map((slot) => slot.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      layout.features.forEach((slot) => {
        expect(slot.maxWidth).toBeGreaterThan(165);
        expect(slot.x + slot.maxWidth).toBeLessThan(priceLeft);
      });
      layout.separatorXs.forEach((separator, index) => expect(separator).toBeGreaterThan(layout.features[index].x + layout.features[index].maxWidth));
      // The model name must also stop before the SALE seal, which reaches 574 units in from the right.
      expect(layout.model.x + layout.model.maxWidth).toBeLessThanOrEqual(width - 574 * layout.squeeze);
    }
  });

  it("starts the text just after the logo block", () => {
    for (const width of [1495, 1840, 2200]) {
      const layout = computeLabelLayout(width, 3);
      expect(layout.model.x).toBeCloseTo(650 * layout.squeeze);
      expect(layout.features[0].x).toBeCloseTo(653 * layout.squeeze);
    }
  });

  it("lays out every size the editor allows with room for the text", () => {
    for (let width = LABEL_SIZE_LIMITS.widthMm.min; width <= LABEL_SIZE_LIMITS.widthMm.max; width += 10) {
      for (let height = LABEL_SIZE_LIMITS.heightMm.min; height <= LABEL_SIZE_LIMITS.heightMm.max; height += 1) {
        const size = clampLabelSize({ widthMm: width, heightMm: height });
        const layout = computeLabelLayout(designWidth(size), 3);
        // The squarest shape, 180 × 30 mm, has the least room in design units (583 and 158), but its taller
        // label makes every unit larger: the middle slot is 20.6 mm wide, more than 18.5 mm at 160 × 24.6 mm.
        expect(layout.model.maxWidth).toBeGreaterThan(580);
        layout.features.forEach((slot) => expect(slot.maxWidth).toBeGreaterThan(155));
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
    const narrow = computeLabelLayout(1495, 3).model.maxWidth;
    const model = "M".repeat(34); // the widest letters at the longest length the editor accepts
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
