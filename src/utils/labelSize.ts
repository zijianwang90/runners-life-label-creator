import type { LabelSize } from "../types";

/** The approved Scheme A label. */
export const DEFAULT_LABEL_SIZE: LabelSize = { widthMm: 220, heightMm: 23 };

/**
 * Width and height are limited individually, and also together: the label design is drawn on a fixed
 * 230-unit-tall canvas whose width follows the aspect ratio, so a label that is too square leaves no
 * room for the model name and selling points, and one that is too long leaves them stranded.
 */
export const LABEL_SIZE_LIMITS = {
  widthMm: { min: 120, max: 280 },
  heightMm: { min: 15, max: 35 },
  aspect: { min: 8, max: 12.5 }
} as const;

export const A4_LANDSCAPE = { widthMm: 297, heightMm: 210, marginYmm: 13 } as const;

export interface Range { min: number; max: number }
export interface LabelSizeRanges { widthMm: Range; heightMm: Range }

const roundTenth = (value: number) => Math.round(value * 10) / 10;
const ceilTenth = (value: number) => Math.ceil(value * 10 - 1e-9) / 10;
const floorTenth = (value: number) => Math.floor(value * 10 + 1e-9) / 10;
const clamp = (value: number, { min, max }: Range) => Math.min(max, Math.max(min, value));

/** The widths and heights that are valid for the label's current other dimension. */
export function labelSizeRanges(size: LabelSize): LabelSizeRanges {
  const { widthMm: w, heightMm: h, aspect } = LABEL_SIZE_LIMITS;
  const widthRange = {
    min: ceilTenth(Math.max(w.min, size.heightMm * aspect.min)),
    max: floorTenth(Math.min(w.max, size.heightMm * aspect.max))
  };
  const heightRange = {
    min: ceilTenth(Math.max(h.min, size.widthMm / aspect.max)),
    max: floorTenth(Math.min(h.max, size.widthMm / aspect.min))
  };
  return {
    widthMm: widthRange.min <= widthRange.max ? widthRange : { min: widthRange.min, max: widthRange.min },
    heightMm: heightRange.min <= heightRange.max ? heightRange : { min: heightRange.min, max: heightRange.min }
  };
}

const finiteOr = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Brings any size into the valid range. `anchor` is the dimension the user just changed: it keeps its
 * value (within its own limits) and the other dimension moves if the aspect ratio would otherwise break.
 */
export function clampLabelSize(input: Partial<Record<keyof LabelSize, unknown>> | null | undefined, anchor: keyof LabelSize = "widthMm"): LabelSize {
  const { widthMm: w, heightMm: h } = LABEL_SIZE_LIMITS;
  const requested: LabelSize = {
    widthMm: finiteOr(input?.widthMm, DEFAULT_LABEL_SIZE.widthMm),
    heightMm: finiteOr(input?.heightMm, DEFAULT_LABEL_SIZE.heightMm)
  };
  if (anchor === "widthMm") {
    const widthMm = roundTenth(clamp(requested.widthMm, w));
    const heightMm = roundTenth(clamp(requested.heightMm, labelSizeRanges({ widthMm, heightMm: requested.heightMm }).heightMm));
    return { widthMm, heightMm };
  }
  const heightMm = roundTenth(clamp(requested.heightMm, h));
  const widthMm = roundTenth(clamp(requested.widthMm, labelSizeRanges({ widthMm: requested.widthMm, heightMm }).widthMm));
  return { widthMm, heightMm };
}

export interface LabelSizeChange {
  size: LabelSize;
  /** The other dimension, when it had to move to keep the aspect ratio valid; null if nothing else changed. */
  adjusted: keyof LabelSize | null;
}

/** Applies one edit. The edited dimension keeps its value; the other is pulled in range and reported. */
export function changeLabelSize(current: LabelSize, dimension: keyof LabelSize, value: number): LabelSizeChange {
  const size = clampLabelSize({ ...current, [dimension]: value }, dimension);
  const other: keyof LabelSize = dimension === "widthMm" ? "heightMm" : "widthMm";
  return { size, adjusted: size[other] !== current[other] ? other : null };
}

export const isDefaultLabelSize = (size: LabelSize) =>
  size.widthMm === DEFAULT_LABEL_SIZE.widthMm && size.heightMm === DEFAULT_LABEL_SIZE.heightMm;

/** "220" / "22.5" — no trailing ".0". */
export const formatMm = (value: number): string => String(roundTenth(value));
export const formatLabelSize = (size: LabelSize): string => `${formatMm(size.widthMm)} × ${formatMm(size.heightMm)} mm`;

export interface A4Layout {
  /** Labels stacked on one landscape sheet. */
  perPage: number;
  leftMm: number;
  topMm: number;
  stackHeightMm: number;
}

/** Stacks as many labels as fit between the sheet's top and bottom margins, centred on the page. */
export function a4Layout(size: LabelSize): A4Layout {
  const usableHeight = A4_LANDSCAPE.heightMm - A4_LANDSCAPE.marginYmm * 2;
  const perPage = Math.max(1, Math.floor(usableHeight / size.heightMm + 1e-9));
  const stackHeightMm = perPage * size.heightMm;
  return {
    perPage,
    leftMm: (A4_LANDSCAPE.widthMm - size.widthMm) / 2,
    topMm: (A4_LANDSCAPE.heightMm - stackHeightMm) / 2,
    stackHeightMm
  };
}
