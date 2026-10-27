import { useEffect, useRef, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import type { LabelSize } from "../types";
import {
  changeLabelSize,
  DEFAULT_LABEL_SIZE,
  formatLabelSize,
  formatMm,
  isDefaultLabelSize,
  LABEL_SIZE_LIMITS
} from "../utils/labelSize";

const DIMENSION_NAMES = { widthMm: "Width", heightMm: "Height" } as const;
const NOTICE_MS = 7000;

interface SizeFieldProps {
  dimension: keyof LabelSize;
  value: number;
  /** True when applying this value would not force the other dimension to move. */
  isHarmless: (value: number) => boolean;
  onCommit: (value: number) => void;
}

const parse = (text: string): number | null => {
  const parsed = Number(text);
  return text.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
};

function SizeField({ dimension, value, isHarmless, onCommit }: SizeFieldProps) {
  const range = LABEL_SIZE_LIMITS[dimension];
  const label = DIMENSION_NAMES[dimension];
  const [draft, setDraft] = useState(formatMm(value));
  const editing = useRef(false);

  // Follow outside changes: the slider, Reset, or the other dimension being adjusted.
  useEffect(() => {
    if (!editing.current) setDraft(formatMm(value));
  }, [value]);

  // Reads the text from the input itself, so leaving the field right after typing never uses a stale draft.
  const settle = (text: string) => {
    editing.current = false;
    const parsed = parse(text);
    if (parsed === null) { setDraft(formatMm(value)); return; }
    const clamped = Math.min(range.max, Math.max(range.min, parsed));
    setDraft(formatMm(clamped));
    onCommit(clamped);
  };

  return (
    <div className="size-field">
      <label>
        <span>{label}</span>
        <small>{range.min}–{range.max} mm</small>
      </label>
      <input
        className="size-slider"
        type="range"
        aria-label={`${label} slider`}
        min={range.min}
        max={range.max}
        step={0.5}
        value={value}
        onChange={(event) => onCommit(Number(event.target.value))}
      />
      <div className="size-number">
        <input
          type="number"
          aria-label={`${label} in millimetres`}
          min={range.min}
          max={range.max}
          step={0.1}
          value={draft}
          onFocus={() => { editing.current = true; }}
          onChange={(event) => {
            setDraft(event.target.value);
            const parsed = parse(event.target.value);
            // Preview live only when the typed number is complete and moves nothing else. Typing "1", "18", "185"
            // must not push the other dimension around on the way; anything that would adjust it waits for Enter/blur.
            if (parsed !== null && parsed >= range.min && parsed <= range.max && isHarmless(parsed)) onCommit(parsed);
          }}
          onBlur={(event) => settle(event.currentTarget.value)}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        />
        <span>mm</span>
      </div>
    </div>
  );
}

interface LabelSizeControlsProps {
  size: LabelSize;
  onChange: (size: LabelSize) => void;
}

export function LabelSizeControls({ size, onChange }: LabelSizeControlsProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const { aspect } = LABEL_SIZE_LIMITS;

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const change = (dimension: keyof LabelSize) => (value: number) => {
    const { size: next, adjusted } = changeLabelSize(size, dimension, value);
    setNotice(adjusted
      ? `${DIMENSION_NAMES[adjusted]} changed from ${formatMm(size[adjusted])} to ${formatMm(next[adjusted])} mm so the label stays between ${aspect.min}:1 and ${aspect.max}:1.`
      : null);
    onChange(next);
  };
  const isHarmless = (dimension: keyof LabelSize) => (value: number) => changeLabelSize(size, dimension, value).adjusted === null;

  return (
    <section className="size-panel" aria-label="Label size">
      <div className="size-panel-head">
        <div>
          <span className="eyebrow">LABEL SIZE</span>
          <strong>{formatLabelSize(size)}</strong>
        </div>
        <button
          className="size-reset"
          type="button"
          disabled={isDefaultLabelSize(size)}
          onClick={() => { setNotice(null); onChange({ ...DEFAULT_LABEL_SIZE }); }}
        >
          <RotateCcw size={13} /> Reset to {formatLabelSize(DEFAULT_LABEL_SIZE).replace(" mm", "")}
        </button>
      </div>
      <SizeField dimension="widthMm" value={size.widthMm} isHarmless={isHarmless("widthMm")} onCommit={change("widthMm")} />
      <SizeField dimension="heightMm" value={size.heightMm} isHarmless={isHarmless("heightMm")} onCommit={change("heightMm")} />
      {notice && <p className="size-notice" role="status"><Info size={14} />{notice}</p>}
      <p className="size-note">
        The label must stay between {aspect.min}:1 and {aspect.max}:1 so the logo, model name, selling points and price all fit;
        if a change would break that, the other value adjusts automatically. Now {(size.widthMm / size.heightMm).toFixed(1)}:1.
      </p>
    </section>
  );
}
