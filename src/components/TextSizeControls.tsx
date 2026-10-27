import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { TextScales } from "../types";
import { clampTextScale, TEXT_SCALE_LIMITS, textPrintSize, type TextKind } from "../utils/labelSize";

interface TextSizeControlsProps {
  scales: TextScales;
  /** Physical label height, used to show how large the text will actually print. */
  heightMm: number;
  onChange: (scales: Partial<TextScales>) => void;
}

const ROWS: { kind: TextKind; key: keyof TextScales; name: string; title: string }[] = [
  { kind: "model", key: "modelTextScale", name: "Model name", title: "Model" },
  { kind: "feature", key: "featureTextScale", name: "Selling point", title: "Selling points" },
  { kind: "price", key: "priceTextScale", name: "Price", title: "Price" }
];

const PRESETS = [100, 115, 130, 150] as const;

interface TextSizeRowProps {
  kind: TextKind;
  name: string;
  title: string;
  scale: number;
  heightMm: number;
  onChange: (scale: number) => void;
}

/** One slider and percent field; a typed number applies once it is in range and is clamped when leaving the field. */
function TextSizeRow({ kind, name, title, scale: requestedScale, heightMm, onChange }: TextSizeRowProps) {
  const limits = TEXT_SCALE_LIMITS[kind];
  const minPercent = Math.round(limits.min * 100);
  const maxPercent = Math.round(limits.max * 100);
  const toScale = (percent: number) => clampTextScale(kind, percent / 100);
  const scale = clampTextScale(kind, requestedScale);
  const percent = Math.round(scale * 100);
  const [draft, setDraft] = useState(String(percent));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(String(percent));
  }, [percent]);

  const printed = textPrintSize(kind, scale, heightMm);

  // Reads the text from the input itself, so leaving the field right after typing never uses a stale draft.
  const settle = (text: string) => {
    editing.current = false;
    const parsed = Number(text);
    if (text.trim() === "" || !Number.isFinite(parsed)) { setDraft(String(percent)); return; }
    const next = toScale(parsed);
    setDraft(String(Math.round(next * 100)));
    onChange(next);
  };

  return (
    <div className="text-size-row">
      <div className="size-field">
        <label>
          <span>{title}</span>
          <small title={`${minPercent}–${maxPercent}%`}>≈ {printed.pt.toFixed(1)} pt</small>
        </label>
        <input
          className="size-slider"
          type="range"
          aria-label={`${name} text size slider`}
          min={minPercent}
          max={maxPercent}
          step={5}
          value={percent}
          onChange={(event) => onChange(toScale(Number(event.target.value)))}
        />
        <div className="size-number">
          <input
            type="number"
            aria-label={`${name} text size in percent`}
            min={minPercent}
            max={maxPercent}
            step={5}
            value={draft}
            onFocus={() => { editing.current = true; }}
            onChange={(event) => {
              setDraft(event.target.value);
              const parsed = Number(event.target.value);
              if (event.target.value.trim() !== "" && parsed >= minPercent && parsed <= maxPercent) onChange(toScale(parsed));
            }}
            onBlur={(event) => settle(event.currentTarget.value)}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          />
          <span>%</span>
        </div>
      </div>
      <div className="text-presets" role="group" aria-label={`${name} quick sizes`}>
        {PRESETS.filter((preset) => preset <= maxPercent).map((preset) => (
          <button key={preset} type="button" className={percent === preset ? "is-current" : ""} onClick={() => onChange(toScale(preset))}>{preset}%</button>
        ))}
      </div>
    </div>
  );
}

/** Sizes of the model name, selling points and price on every label, each with its printed height in points. */
export function TextSizeControls({ scales, heightMm, onChange }: TextSizeControlsProps) {
  const allDefault = ROWS.every(({ kind, key }) => clampTextScale(kind, scales[key]) === TEXT_SCALE_LIMITS[kind].default);
  const resetAll = () => onChange(Object.fromEntries(ROWS.map(({ kind, key }) => [key, TEXT_SCALE_LIMITS[kind].default])));

  return (
    <section className="size-panel" aria-label="Label text size">
      <div className="size-panel-head">
        <div>
          <span className="eyebrow">TEXT SIZE</span>
          <strong>Model · selling points · price</strong>
        </div>
        <button className="size-reset" type="button" disabled={allDefault} onClick={resetAll}>
          <RotateCcw size={13} /> Reset all to 100%
        </button>
      </div>
      {ROWS.map(({ kind, key, name, title }) => (
        <TextSizeRow key={key} kind={kind} name={name} title={title} scale={scales[key]} heightMm={heightMm} onChange={(scale) => onChange({ [key]: scale })} />
      ))}
      <p className="size-note">
        Applies to every label; pt is the printed height on a {heightMm} mm tall label. Text too long for its space shrinks to fit, so short model names and phrases print largest.
        Limits: model {Math.round(TEXT_SCALE_LIMITS.model.max * 100)}%, selling points {Math.round(TEXT_SCALE_LIMITS.feature.max * 100)}%, price {Math.round(TEXT_SCALE_LIMITS.price.max * 100)}%.
      </p>
    </section>
  );
}
