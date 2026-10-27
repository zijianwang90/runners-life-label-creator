import { CheckCircle2, CircleAlert } from "lucide-react";
import type { LabelSize, ShoeLabel, TextScales } from "../types";
import { getPriceState, validateShoe } from "../utils/labels";
import { formatLabelSize, formatMm } from "../utils/labelSize";
import { LabelSizeControls } from "./LabelSizeControls";
import { LabelSvg } from "./LabelSvg";
import { TextSizeControls } from "./TextSizeControls";

interface PreviewPanelProps {
  shoe: ShoeLabel | null;
  currencySymbol: string;
  labelSize: LabelSize;
  onLabelSizeChange: (size: LabelSize) => void;
  textScales: TextScales;
  onTextScalesChange: (scales: Partial<TextScales>) => void;
}

export function PreviewPanel({ shoe, currencySymbol, labelSize, onLabelSizeChange, textScales, onTextScalesChange }: PreviewPanelProps) {
  if (!shoe) {
    return <aside className="preview-panel empty-preview"><p>Select a shoe to preview its printed label.</p></aside>;
  }
  const validation = validateShoe(shoe);
  const priceState = getPriceState(shoe);
  return (
    <aside className="preview-panel">
      <div className="preview-heading">
        <div>
          <span className="eyebrow">LIVE PRINT PREVIEW</span>
          <h2>{formatLabelSize(labelSize)}</h2>
        </div>
        <span className={`preview-status ${validation.valid ? "ready" : "needs-work"}`}>
          {validation.valid ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
          {validation.valid ? "Ready" : "Needs attention"}
        </span>
      </div>

      <div className="label-stage">
        <LabelSvg shoe={shoe} currencySymbol={currencySymbol} size={labelSize} modelScale={textScales.modelTextScale} featureScale={textScales.featureTextScale} priceScale={textScales.priceTextScale} />
      </div>
      <div className="dimension-line"><span>{formatMm(labelSize.widthMm)} mm</span></div>

      <LabelSizeControls size={labelSize} onChange={onLabelSizeChange} />
      <TextSizeControls scales={textScales} heightMm={labelSize.heightMm} onChange={onTextScalesChange} />

      <dl className="preview-meta">
        <div><dt>Price state</dt><dd>{priceState === "sale" ? "Sale seal" : "Regular price"}</dd></div>
        <div><dt>Selling points</dt><dd>{shoe.features.filter((item) => item.trim()).length} / 3</dd></div>
      </dl>
      {!validation.valid && (
        <div className="preview-errors">
          <strong>Resolve before printing</strong>
          <ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}
      <p className="preview-note">Screen dimensions are illustrative. Physical size is controlled by the Electron print page and printer calibration.</p>
    </aside>
  );
}
