import { useEffect, useRef } from "react";
import { ShoppingCart, Sparkles } from "lucide-react";

interface SelectionBarProps {
  shownCount: number;
  selectedCount: number;
  /** How many of the shown labels are ticked. */
  selectedShownCount: number;
  onToggleShown: () => void;
  onClear: () => void;
  onAi: () => void;
  onPrint: () => void;
}

/** Everything that works on the ticked labels lives here: AI selling points and printing. */
export function SelectionBar(props: SelectionBarProps) {
  const checkbox = useRef<HTMLInputElement>(null);
  const allShown = props.shownCount > 0 && props.selectedShownCount === props.shownCount;
  const someShown = props.selectedShownCount > 0 && !allShown;

  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = someShown;
  }, [someShown]);

  return (
    <div className={`selection-bar ${props.selectedCount > 0 ? "has-selection" : ""}`}>
      <label className="selection-all">
        <input ref={checkbox} type="checkbox" checked={allShown} disabled={props.shownCount === 0} onChange={props.onToggleShown} />
        <span>{allShown ? "Deselect shown" : "Select shown"}</span>
      </label>
      <span className="selection-count" aria-live="polite">
        {props.selectedCount > 0 ? <><strong>{props.selectedCount}</strong> selected</> : "Tick labels to work on them together"}
      </span>
      {props.selectedCount > 0 && <button className="selection-clear" onClick={props.onClear}>Clear</button>}
      <div className="selection-actions">
        <button className="secondary-button" onClick={props.onAi} title="Write the three selling points with an AI tool">
          <Sparkles size={16} /> AI selling points
        </button>
        <button className="primary-button" disabled={props.selectedCount === 0} onClick={props.onPrint} title="Print selected (Ctrl/Cmd+P)">
          <ShoppingCart size={16} /> Print selected <span className="cart-count">{props.selectedCount}</span>
        </button>
      </div>
    </div>
  );
}
