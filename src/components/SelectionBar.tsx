import { useEffect, useRef } from "react";
import { ListPlus, ShoppingCart, Sparkles } from "lucide-react";

interface SelectionBarProps {
  shownCount: number;
  selectedCount: number;
  /** How many of the shown labels are ticked. */
  selectedShownCount: number;
  onToggleShown: () => void;
  onClear: () => void;
  /** Labels and physical copies on the print list. */
  cartLabels: number;
  cartCopies: number;
  onAi: () => void;
  onAddSelected: () => void;
  onOpenCart: () => void;
}

/** What works on the ticked labels (AI selling points, adding them to the print list) and the print list itself. */
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
        {props.selectedCount > 0 && (
          <button className="secondary-button" onClick={props.onAddSelected} title="Add one copy of each ticked label to the print list">
            <ListPlus size={16} /> Add {props.selectedCount} to print list
          </button>
        )}
        <button
          className="primary-button"
          disabled={props.cartLabels === 0}
          onClick={props.onOpenCart}
          title={`${props.cartLabels} label${props.cartLabels === 1 ? "" : "s"} on the print list (Ctrl/Cmd+P)`}
        >
          <ShoppingCart size={16} /> Print list <span className="cart-count">{props.cartCopies}</span>
        </button>
      </div>
    </div>
  );
}
