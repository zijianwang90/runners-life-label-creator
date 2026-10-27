import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { clampFeatureScale, FEATURE_TEXT_SCALE, featureTextPrintSize } from "../utils/labelSize";

interface FeatureTextControlsProps {
  scale: number;
  /** Physical label height, used to show how large the text will actually print. */
  heightMm: number;
  onChange: (scale: number) => void;
}

const MIN_PERCENT = Math.round(FEATURE_TEXT_SCALE.min * 100);
const MAX_PERCENT = Math.round(FEATURE_TEXT_SCALE.max * 100);
const PRESETS = [100, 130, 150, 170] as const;

const toScale = (percent: number) => clampFeatureScale(percent / 100);

/** One size for the three selling points on every label, with the printed text height shown in points. */
export function FeatureTextControls({ scale, heightMm, onChange }: FeatureTextControlsProps) {
  const percent = Math.round(scale * 100);
  const [draft, setDraft] = useState(String(percent));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(String(percent));
  }, [percent]);

  const printed = featureTextPrintSize(scale, heightMm);

  const settle = () => {
    editing.current = false;
    const parsed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed)) { setDraft(String(percent)); return; }
    const next = toScale(parsed);
    setDraft(String(Math.round(next * 100)));
    onChange(next);
  };

  return (
    <section className="size-panel" aria-label="Selling point text size">
      <div className="size-panel-head">
        <div>
          <span className="eyebrow">SELLING POINT TEXT</span>
          <strong>{percent}%</strong>
        </div>
        <button className="size-reset" type="button" disabled={percent === 100} onClick={() => onChange(FEATURE_TEXT_SCALE.default)}>
          <RotateCcw size={13} /> Reset to 100%
        </button>
      </div>
      <div className="size-field">
        <label>
          <span>Size</span>
          <small>{MIN_PERCENT}–{MAX_PERCENT}%</small>
        </label>
        <input
          className="size-slider"
          type="range"
          aria-label="Selling point text size slider"
          min={MIN_PERCENT}
          max={MAX_PERCENT}
          step={5}
          value={percent}
          onChange={(event) => onChange(toScale(Number(event.target.value)))}
        />
        <div className="size-number">
          <input
            type="number"
            aria-label="Selling point text size in percent"
            min={MIN_PERCENT}
            max={MAX_PERCENT}
            step={5}
            value={draft}
            onFocus={() => { editing.current = true; }}
            onChange={(event) => {
              setDraft(event.target.value);
              const parsed = Number(event.target.value);
              if (event.target.value.trim() !== "" && parsed >= MIN_PERCENT && parsed <= MAX_PERCENT) onChange(toScale(parsed));
            }}
            onBlur={settle}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          />
          <span>%</span>
        </div>
      </div>
      <div className="text-presets" role="group" aria-label="Quick sizes">
        {PRESETS.map((preset) => (
          <button key={preset} type="button" className={percent === preset ? "is-current" : ""} onClick={() => onChange(toScale(preset))}>{preset}%</button>
        ))}
      </div>
      <p className="size-readout" aria-live="polite">
        Short phrases print at about <strong>{printed.pt.toFixed(1)} pt</strong> ({printed.mm.toFixed(1)} mm) on a {heightMm} mm tall label.
      </p>
      <p className="size-note">
        Applies to all three selling points on every label. A phrase too long for its space shrinks to fit, so shorter points print larger.
      </p>
    </section>
  );
}
