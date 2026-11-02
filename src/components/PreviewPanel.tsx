import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, SlidersHorizontal } from "lucide-react";
import type { LabelSize, ShoeLabel, TextScales } from "../types";
import { getPriceState, validateShoe } from "../utils/labels";
import { formatLabelSize } from "../utils/labelSize";
import { LabelSizeControls } from "./LabelSizeControls";
import { LabelSvg, labelScaleProps } from "./LabelSvg";
import { TextSizeControls } from "./TextSizeControls";

interface PreviewPanelProps {
  shoe: ShoeLabel | null;
  labelSize: LabelSize;
  onLabelSizeChange: (size: LabelSize) => void;
  textScales: TextScales;
  onTextScalesChange: (scales: Partial<TextScales>) => void;
}

/** Full-width live preview above the list. Label size and text size apply to every label, so they sit in a popover. */
export function PreviewPanel({ shoe, labelSize, onLabelSizeChange, textScales, onTextScalesChange }: PreviewPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSettingsOpen(false); };
    const onPointerDown = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node)) setSettingsOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("pointerdown", onPointerDown); };
  }, [settingsOpen]);

  const validation = shoe ? validateShoe(shoe) : null;
  const priceState = shoe ? getPriceState(shoe) : null;
  return (
    <section className="preview-panel" ref={panel} aria-label="Label preview">
      <div className="preview-heading">
        <span className="eyebrow">LIVE PRINT PREVIEW</span>
        <strong className="preview-size">{formatLabelSize(labelSize)}</strong>
        {shoe && validation && (
          <>
            <span className="preview-name">{shoe.model || "Untitled"}</span>
            <span className="preview-kind">{priceState === "sale" ? "Sale seal" : "Regular price"}</span>
            <span className={`preview-status ${validation.valid ? "ready" : "needs-work"}`} title={validation.valid ? undefined : validation.errors.join(" ")}>
              {validation.valid ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
              {validation.valid ? "Ready" : validation.errors[0]}
            </span>
          </>
        )}
        <button type="button" className="secondary-button preview-settings-button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}
          title="Label size and text size apply to every label">
          <SlidersHorizontal size={15} /> Label size &amp; text
        </button>
      </div>

      {shoe
        ? <div className="label-stage"><LabelSvg shoe={shoe} size={labelSize} {...labelScaleProps(textScales)} /></div>
        : <div className="label-stage empty-preview"><p>Select a shoe to preview its printed label.</p></div>}

      {settingsOpen && (
        <div className="preview-settings" role="dialog" aria-label="Label size and text size">
          <LabelSizeControls size={labelSize} onChange={onLabelSizeChange} />
          <TextSizeControls scales={textScales} heightMm={labelSize.heightMm} onChange={onTextScalesChange} />
        </div>
      )}
    </section>
  );
}
