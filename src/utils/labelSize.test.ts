import { describe, expect, it } from "vitest";
import {
  a4Layout,
  changeLabelSize,
  clampLabelSize,
  DEFAULT_LABEL_SIZE,
  formatLabelSize,
  LABEL_SIZE_LIMITS,
  labelSizeRanges
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
    // Taller than a 200 mm label can carry: the height wins when it is the anchor, so the width grows.
    const tall = clampLabelSize({ widthMm: 200, heightMm: 30 }, "heightMm");
    expect(tall.heightMm).toBe(30);
    expect(tall.widthMm).toBe(240);

    // Same request anchored on the width: the height gives way instead.
    const narrow = clampLabelSize({ widthMm: 200, heightMm: 30 }, "widthMm");
    expect(narrow.widthMm).toBe(200);
    expect(narrow.heightMm).toBe(25);
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
    const ranges = labelSizeRanges(DEFAULT_LABEL_SIZE);
    expect(ranges.widthMm).toEqual({ min: 184, max: 280 });
    expect(ranges.heightMm).toEqual({ min: 17.6, max: 27.5 });
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
    // 150 mm wide with a 25 mm height is 6:1, narrower than allowed: the height gives way.
    expect(changeLabelSize({ widthMm: 200, heightMm: 25 }, "widthMm", 150)).toEqual({ size: { widthMm: 150, heightMm: 18.7 }, adjusted: "heightMm" });
    // 30 mm tall needs at least 240 mm of width.
    expect(changeLabelSize({ widthMm: 200, heightMm: 25 }, "heightMm", 30)).toEqual({ size: { widthMm: 240, heightMm: 30 }, adjusted: "widthMm" });
    // Too long and thin: 200 × 15 is 13.3:1, so the width gives way.
    expect(changeLabelSize({ widthMm: 200, heightMm: 25 }, "heightMm", 15)).toEqual({ size: { widthMm: 187.5, heightMm: 15 }, adjusted: "widthMm" });
    // A wide label that is still within the limits needs no adjustment.
    expect(changeLabelSize({ widthMm: 200, heightMm: 25 }, "widthMm", 280).adjusted).toBeNull();
  });

  it("does not report an adjustment when the other value is already right", () => {
    expect(changeLabelSize({ widthMm: 200, heightMm: 25 }, "widthMm", 200).adjusted).toBeNull();
  });
});

describe("A4 landscape imposition", () => {
  it("reproduces the approved sheet: eight 220 × 23 mm labels, centred", () => {
    expect(a4Layout(DEFAULT_LABEL_SIZE)).toEqual({ perPage: 8, leftMm: 38.5, topMm: 13, stackHeightMm: 184 });
  });

  it("fits more short labels and fewer tall ones", () => {
    expect(a4Layout({ widthMm: 180, heightMm: 15 }).perPage).toBe(12);
    expect(a4Layout({ widthMm: 280, heightMm: 35 }).perPage).toBe(5);
  });

  it("leaves room for the crop marks beside the widest label", () => {
    const { leftMm } = a4Layout({ widthMm: LABEL_SIZE_LIMITS.widthMm.max, heightMm: 30 });
    expect(leftMm).toBeGreaterThanOrEqual(6.5);
  });
});
