import type { LabelSize } from "../types";

/**
 * The label is drawn on a canvas that is always 230 units tall. Its width follows the label's aspect
 * ratio (220 × 23 mm → 2200 units), so changing the physical height scales the whole design, while
 * changing the width changes how much room the model name and selling points get.
 *
 * At the approved width and wider, the left mark/brand block (0–600) and the price block (532 units on
 * the right) keep their size and the text area takes all the extra width. Narrower than that, the two
 * blocks shrink together with the text area (see `squeezeFor`) so the text is not crushed.
 */
export const DESIGN_HEIGHT = 230;
export const BASE_DESIGN_WIDTH = 2200;
const LEFT_BLOCK_WIDTH = 600;
const PRICE_BLOCK_WIDTH = 532;
/** Share of every unit of width missing below the approved width that the logo and price blocks give up. */
const SQUEEZE_SHARE = 0.5;

/** 1 at the approved width and above; below it, the factor the logo and price blocks are scaled by. */
export const squeezeFor = (width: number): number =>
  width >= BASE_DESIGN_WIDTH ? 1 : 1 - (SQUEEZE_SHARE * (BASE_DESIGN_WIDTH - width)) / (LEFT_BLOCK_WIDTH + PRICE_BLOCK_WIDTH);

export const designWidth = (size: LabelSize): number => (DESIGN_HEIGHT * size.widthMm) / size.heightMm;

const MODEL_X = 650;
const MODEL_RIGHT_INSET = 600;
const FEATURE_FIRST_X = 653;
const FEATURE_RIGHT_INSET = 550;
const FEATURE_SEPARATOR_GAP = 18;
const FEATURE_SPAN_AT_BASE = BASE_DESIGN_WIDTH - FEATURE_RIGHT_INSET - FEATURE_FIRST_X;

/** Slot positions at the approved 2200-unit width; they stretch or squeeze with the available space. */
const FEATURE_SLOTS: Record<1 | 2 | 3, { starts: number[]; separators: number[] }> = {
  1: { starts: [653], separators: [] },
  2: { starts: [653, 1125], separators: [1080] },
  3: { starts: [653, 1007, 1321], separators: [979, 1293] }
};

export interface FeatureSlot { x: number; maxWidth: number }

export interface LabelLayout {
  /** Canvas width in design units; the viewBox is `0 0 width 230`. */
  width: number;
  /** Scale of the logo and price blocks: 1 at the approved width and above, smaller on narrower labels. */
  squeeze: number;
  model: { x: number; y: number; maxWidth: number };
  features: FeatureSlot[];
  separatorXs: number[];
}

export function computeLabelLayout(width: number, featureCount: number): LabelLayout {
  const count = Math.min(3, Math.max(0, Math.round(featureCount)));
  const squeeze = squeezeFor(width);
  const modelX = MODEL_X * squeeze;
  const firstX = FEATURE_FIRST_X * squeeze;
  const rightLimit = width - FEATURE_RIGHT_INSET * squeeze;
  const spread = (rightLimit - firstX) / FEATURE_SPAN_AT_BASE;
  const slotSet = count === 0 ? { starts: [], separators: [] } : FEATURE_SLOTS[count as 1 | 2 | 3];
  const xs = slotSet.starts.map((start) => firstX + (start - FEATURE_FIRST_X) * spread);
  const separatorXs = slotSet.separators.map((x) => firstX + (x - FEATURE_FIRST_X) * spread);

  return {
    width,
    squeeze,
    model: { x: modelX, y: count === 0 ? 137 : 105, maxWidth: width - modelX - MODEL_RIGHT_INSET * squeeze },
    features: xs.map((x, index) => ({
      x,
      maxWidth: (index < separatorXs.length ? separatorXs[index] - FEATURE_SEPARATOR_GAP : rightLimit) - x
    })),
    separatorXs
  };
}

// Advance widths (em) of Barlow Condensed, the label's bundled font, measured from the font itself.
const GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ &+-/.,'%()!:\"°×#";
const ADVANCES: Record<600 | 800, number[]> = {
  800: [
    0.46, 0.29, 0.45, 0.45, 0.51, 0.45, 0.45, 0.42, 0.45, 0.45,
    0.51, 0.48, 0.47, 0.48, 0.44, 0.43, 0.47, 0.48, 0.24, 0.46, 0.51, 0.44, 0.56,
    0.52, 0.48, 0.47, 0.47, 0.48, 0.45, 0.49, 0.48, 0.51, 0.71, 0.49, 0.49, 0.42,
    0.2, 0.62, 0.44, 0.34, 0.44, 0.24, 0.22, 0.19, 0.76, 0.34, 0.34, 0.29, 0.3, 0.39, 0.36, 0.41, 0.63
  ],
  600: [
    0.45, 0.27, 0.43, 0.43, 0.46, 0.43, 0.43, 0.39, 0.43, 0.42,
    0.46, 0.46, 0.46, 0.47, 0.44, 0.42, 0.46, 0.48, 0.22, 0.44, 0.48, 0.42, 0.54,
    0.51, 0.47, 0.46, 0.46, 0.46, 0.43, 0.45, 0.48, 0.47, 0.67, 0.46, 0.46, 0.41,
    0.2, 0.58, 0.44, 0.33, 0.39, 0.21, 0.2, 0.15, 0.77, 0.28, 0.28, 0.27, 0.25, 0.31, 0.36, 0.39, 0.61
  ]
};
const ADVANCE_LOOKUP: Record<600 | 800, Map<string, number>> = {
  600: new Map([...GLYPHS].map((glyph, index) => [glyph, ADVANCES[600][index]])),
  800: new Map([...GLYPHS].map((glyph, index) => [glyph, ADVANCES[800][index]]))
};
export const GLYPH_TABLE_SIZE = GLYPHS.length;
export const GLYPH_ADVANCE_COUNTS = { 600: ADVANCES[600].length, 800: ADVANCES[800].length };

const UNKNOWN_ADVANCE = 0.5;
const WIDE_ADVANCE = 1;

function advanceOf(char: string, weight: 600 | 800): number {
  const known = ADVANCE_LOOKUP[weight].get(char);
  if (known !== undefined) return known;
  const code = char.codePointAt(0) ?? 0;
  return code >= 0x2e80 ? WIDE_ADVANCE : UNKNOWN_ADVANCE;
}

/** Width of the text as the label draws it: upper-cased, in the given weight, with SVG letter spacing. */
export function estimateTextWidth(text: string, fontSize: number, weight: 600 | 800, letterSpacing = 0): number {
  const chars = [...text.toUpperCase()];
  const em = chars.reduce((sum, char) => sum + advanceOf(char, weight), 0);
  return em * fontSize + letterSpacing * chars.length;
}

export interface FitOptions {
  baseSize: number;
  maxWidth: number;
  weight: 600 | 800;
  letterSpacing?: number;
  /** Smallest share of `baseSize` the text may shrink to before it is condensed instead. */
  minRatio?: number;
}

export interface TextFit {
  fontSize: number;
  /** Set only when shrinking is not enough; the SVG then condenses the glyphs to exactly this width. */
  textLength?: number;
}

/** Keeps the approved size whenever the text fits; otherwise shrinks it, then condenses it. */
export function fitText(text: string, { baseSize, maxWidth, weight, letterSpacing = 0, minRatio = 0.8 }: FitOptions): TextFit {
  if (!text.trim() || estimateTextWidth(text, baseSize, weight, letterSpacing) <= maxWidth) return { fontSize: baseSize };
  const emWidth = estimateTextWidth(text, 1, weight, 0);
  const spacing = letterSpacing * [...text].length;
  const wanted = (maxWidth - spacing) / emWidth;
  const fontSize = Math.floor(Math.min(baseSize, Math.max(baseSize * minRatio, wanted)) * 10) / 10;
  return estimateTextWidth(text, fontSize, weight, letterSpacing) <= maxWidth
    ? { fontSize }
    : { fontSize, textLength: Math.round(maxWidth * 10) / 10 };
}
