import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Copy, Pencil, ShoppingCart, Trash2, TriangleAlert } from "lucide-react";
import { brandLogos, brandNames } from "../assets";
import { BRAND_IDS, PLATE_TYPES, type PlateType, type ShoeLabel, type ShoeSpecs } from "../types";
import { EMPTY_SPECS, formatMoney, getPriceState, MAX_SUMMARY_LENGTH, PLATE_NAMES, salePercentOf, salePriceFromPercent, validateShoe } from "../utils/labels";
import { QuantityStepper } from "./QuantityStepper";

interface ShoeEditorProps {
  shoe: ShoeLabel;
  index: number;
  selected: boolean;
  active: boolean;
  expanded: boolean;
  currencySymbol: string;
  onToggle: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: (selected: boolean) => void;
  onActivate: () => void;
  onChange: (next: ShoeLabel) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  /** Copies of this label on the print list; null when it is not on it. */
  cartCopies: number | null;
  onAddToCart: () => void;
  onCartCopiesChange: (copies: number) => void;
  onRemoveFromCart: () => void;
}

const numericValue = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

interface SalePercentFieldProps {
  regularPrice: number | null;
  salePrice: number | null;
  onSalePriceChange: (salePrice: number | null) => void;
}

/**
 * Discount off the regular price. Typing a percent sets the sale price; typing a sale price updates the
 * percent. Only the sale price is stored, so the percent follows it when either price changes later.
 */
function SalePercentField({ regularPrice, salePrice, onSalePriceChange }: SalePercentFieldProps) {
  const percent = salePercentOf(regularPrice, salePrice);
  const shown = percent === null ? "" : String(percent);
  const [draft, setDraft] = useState(shown);
  const editing = useRef(false);
  const hasRegular = regularPrice !== null && regularPrice > 0;

  useEffect(() => {
    if (!editing.current) setDraft(shown);
  }, [shown]);

  const parsed = numericValue(draft);
  const error = editing.current && parsed !== null && (parsed <= 0 || parsed >= 100) ? "Use 1–99%." : null;

  return (
    <label className={`field percent-field ${error ? "has-error" : ""}`}>
      <span>Sale %</span>
      <input
        type="number"
        min="1"
        max="99"
        step="1"
        value={draft}
        disabled={!hasRegular}
        placeholder={hasRegular ? "20" : "—"}
        title={hasRegular ? "Percent off the regular price; sets the sale price" : "Enter the regular price first"}
        onFocus={() => { editing.current = true; }}
        onChange={(event) => {
          setDraft(event.target.value);
          const value = numericValue(event.target.value);
          if (!hasRegular) return;
          if (value === null) onSalePriceChange(null);
          else if (value > 0 && value < 100) onSalePriceChange(salePriceFromPercent(regularPrice, value));
        }}
        onBlur={() => { editing.current = false; setDraft(shown); }}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
      />
      {error && <small>{error}</small>}
    </label>
  );
}

interface CartRowProps {
  name: string;
  copies: number | null;
  /** An incomplete label can't be added, so the row offers to finish it instead. */
  complete: boolean;
  onAdd: () => void;
  onCopiesChange: (copies: number) => void;
  onRemove: () => void;
  onComplete: () => void;
}

/** One control per row: Add puts one copy on the print list, then the stepper edits that same count. */
function CartRow({ name, copies, complete, onAdd, onCopiesChange, onRemove, onComplete }: CartRowProps) {
  return (
    <div className={`shoe-row-cart ${copies !== null ? "in-cart" : ""}`} onClick={(event) => event.stopPropagation()}>
      {copies !== null ? (
        <QuantityStepper value={copies} name={name} onChange={onCopiesChange} onRemove={onRemove} />
      ) : complete ? (
        <button type="button" className="secondary-button" onClick={onAdd}><ShoppingCart size={14} /> Add to print list</button>
      ) : (
        <button type="button" className="secondary-button" onClick={onComplete} aria-label={`Complete ${name}`}><Pencil size={14} /> Complete label</button>
      )}
    </div>
  );
}

export function ShoeEditor(props: ShoeEditorProps) {
  const { shoe } = props;
  const editorId = useId();
  const modelButton = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<"basic" | "content">("basic");
  const name = shoe.model || `shoe ${props.index + 1}`;
  const toggle = () => { props.onActivate(); props.onToggle(); };
  const validation = validateShoe(shoe);
  const update = (patch: Partial<ShoeLabel>) => props.onChange({ ...shoe, ...patch, updatedAt: new Date().toISOString() });
  const priceState = getPriceState(shoe);
  const specs = shoe.specs ?? EMPTY_SPECS;
  const updateSpecs = (patch: Partial<ShoeSpecs>) => update({ specs: { ...specs, ...patch } });
  const specNumberField = (key: "heelStackMm" | "forefootStackMm" | "weightG", label: string, unit: string, placeholder: string) => (
    <label className={`field spec-field ${validation.fields.specs ? "has-error" : ""}`}>
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step={key === "weightG" ? "1" : "0.5"}
        value={specs[key] ?? ""}
        placeholder={placeholder}
        onChange={(event) => updateSpecs({ [key]: numericValue(event.target.value) })}
      />
      <em className="spec-unit">{unit}</em>
    </label>
  );

  return (
    <article aria-label={name} className={`shoe-list-item ${props.active ? "is-active" : ""} ${props.expanded ? "is-expanded" : ""}`}>
      <div className="shoe-summary" onClick={props.onActivate}>
        <input type="checkbox" checked={props.selected} onClick={(event) => event.stopPropagation()} onChange={(event) => props.onSelect(event.target.checked)} aria-label={`Select ${name}`} />
        <img className="shoe-brand-logo" src={brandLogos[shoe.brand]} alt={brandNames[shoe.brand]} />
        <div className="shoe-model-cell">
          <button ref={modelButton} type="button" className="shoe-model-name" aria-pressed={props.active} title="Show in the preview; double-click to edit" onDoubleClick={props.onToggle}>{shoe.model || "SHOE MODEL"}</button>
          {!validation.valid && !props.expanded && <small className="shoe-row-issue"><TriangleAlert size={12} /> {validation.errors[0]}</small>}
        </div>
        <div className={`shoe-summary-price ${priceState}`}>
          <strong>{formatMoney(priceState === "sale" ? shoe.salePrice : shoe.regularPrice, props.currencySymbol)}</strong>
          {priceState === "sale" && <del>{formatMoney(shoe.regularPrice, props.currencySymbol)}</del>}
        </div>
        <CartRow name={name} copies={props.cartCopies} complete={validation.valid} onAdd={props.onAddToCart} onCopiesChange={props.onCartCopiesChange} onRemove={props.onRemoveFromCart} onComplete={toggle} />
        <button type="button" className="icon-button" onClick={(event) => { event.stopPropagation(); toggle(); }} aria-expanded={props.expanded} aria-controls={editorId}
          aria-label={`${props.expanded ? "Close" : "Edit"} ${name}`}>{props.expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>
      </div>
      {props.expanded && <div className="shoe-details" id={editorId} onFocusCapture={props.onActivate}>
        <div className="shoe-editor-tabs" role="tablist" aria-label={`Edit ${name}`} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "basic" : event.key === "End" ? "content" : tab === "basic" ? "content" : "basic";
          setTab(next);
          event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[next === "basic" ? 0 : 1]?.focus();
        }}>
          <button type="button" role="tab" tabIndex={tab === "basic" ? 0 : -1} id={`${editorId}-basic-tab`} aria-controls={`${editorId}-basic`} aria-selected={tab === "basic"} onClick={() => setTab("basic")}>Brand &amp; price</button>
          <button type="button" role="tab" tabIndex={tab === "content" ? 0 : -1} id={`${editorId}-content-tab`} aria-controls={`${editorId}-content`} aria-selected={tab === "content"} onClick={() => setTab("content")}>Selling points &amp; specs</button>
        </div>
        <div role="tabpanel" id={`${editorId}-basic`} aria-labelledby={`${editorId}-basic-tab`} hidden={tab !== "basic"}>
          <div className="editor-grid editor-grid-primary">
            <label className="field brand-field">
              <span>Brand</span>
              <div className="brand-select-wrap">
                <img src={brandLogos[shoe.brand]} alt="" />
                <select value={shoe.brand} onChange={(event) => update({ brand: event.target.value as ShoeLabel["brand"] })}>
                  {BRAND_IDS.map((brand) => <option key={brand} value={brand}>{brandNames[brand]}</option>)}
                </select>
              </div>
            </label>

            <label className={`field model-field ${validation.fields.model ? "has-error" : ""}`}>
              <span>Model</span>
              <input
                data-model-input
                autoFocus={!shoe.model}
                value={shoe.model}
                maxLength={50}
                placeholder="e.g. Endorphin Speed 5"
                onChange={(event) => update({ model: event.target.value })}
              />
              {validation.fields.model && <small>{validation.fields.model}</small>}
            </label>

            <label className={`field price-field ${validation.fields.regularPrice ? "has-error" : ""}`}>
              <span>Regular price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={shoe.regularPrice ?? ""}
                placeholder="229.99"
                onChange={(event) => update({ regularPrice: numericValue(event.target.value) })}
              />
              {validation.fields.regularPrice && <small>{validation.fields.regularPrice}</small>}
            </label>

            <label className={`field price-field ${validation.fields.salePrice ? "has-error" : ""}`}>
              <span>Sale price <em>optional</em></span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={shoe.salePrice ?? ""}
                placeholder="189.99"
                onChange={(event) => update({ salePrice: numericValue(event.target.value) })}
              />
              {validation.fields.salePrice && <small>{validation.fields.salePrice}</small>}
            </label>

            <SalePercentField regularPrice={shoe.regularPrice} salePrice={shoe.salePrice} onSalePriceChange={(salePrice) => update({ salePrice })} />

          </div>
        </div>
        <div role="tabpanel" id={`${editorId}-content`} aria-labelledby={`${editorId}-content-tab`} hidden={tab !== "content"}>
          <div className="summary-row">
            <div className="feature-row-label">
              <span>Who it's for</span>
              <small>Optional · one line under the model</small>
            </div>
            <label className={`field summary-field ${validation.fields.summary ? "has-error" : ""}`}>
              <span>Summary</span>
              <input
                value={shoe.summary ?? ""}
                maxLength={80}
                placeholder="e.g. For runners chasing a faster tempo and race pace"
                onChange={(event) => update({ summary: event.target.value })}
              />
              <em className="summary-count">{(shoe.summary ?? "").trim().length}/{MAX_SUMMARY_LENGTH}</em>
            </label>
          </div>
          {validation.fields.summary && <div className="row-error">{validation.fields.summary}</div>}

          <div className="feature-row">
            <div className="feature-row-label">
              <span>Selling points</span>
              <small>Optional · up to 3 phrases</small>
            </div>
            {shoe.features.map((feature, featureIndex) => (
              <label key={featureIndex} className={`field feature-field ${validation.fields.features ? "has-error" : ""}`}>
                <span>{featureIndex + 1}</span>
                <input
                  value={feature}
                  maxLength={45}
                  placeholder={featureIndex === 0 ? "Lightweight & responsive" : featureIndex === 1 ? "Speedroll technology" : "Built for tempo runs"}
                  onChange={(event) => {
                    const features = [...shoe.features] as ShoeLabel["features"];
                    features[featureIndex] = event.target.value;
                    update({ features });
                  }}
                />
              </label>
            ))}
          </div>
          {validation.fields.features && <div className="row-error">{validation.fields.features}</div>}

          <div className="spec-row">
            <div className="feature-row-label">
              <span>Specs</span>
              <small>Optional · printed as a second row</small>
            </div>
            {specNumberField("heelStackMm", "Heel stack", "mm", "39")}
            {specNumberField("forefootStackMm", "Forefoot stack", "mm", "31")}
            {specNumberField("weightG", "Weight", "g", "245")}
            <label className="field spec-field">
              <span>Plate</span>
              <select value={specs.plate} onChange={(event) => updateSpecs({ plate: event.target.value as PlateType })}>
                <option value="">None / not shown</option>
                {PLATE_TYPES.map((plate) => <option key={plate} value={plate}>{PLATE_NAMES[plate]}</option>)}
              </select>
            </label>
          </div>
          {validation.fields.specs && <div className="row-error">{validation.fields.specs}</div>}
        </div>

        <div className="shoe-editor-actions">
          <span className={`state-pill ${priceState}`}>{priceState === "sale" ? "SALE" : "REGULAR"}</span>
          <button className="icon-button" title="Move up" disabled={!props.canMoveUp} onClick={(event) => { event.stopPropagation(); props.onMove(-1); }}><ArrowUp size={16} /></button>
          <button className="icon-button" title="Move down" disabled={!props.canMoveDown} onClick={(event) => { event.stopPropagation(); props.onMove(1); }}><ArrowDown size={16} /></button>
          <button className="icon-button" title="Duplicate" onClick={(event) => { event.stopPropagation(); props.onDuplicate(); }}><Copy size={16} /></button>
          <button className="icon-button danger" title="Delete" onClick={(event) => { event.stopPropagation(); props.onDelete(); }}><Trash2 size={16} /></button>
          <span className={`shoe-editor-status ${validation.valid ? "valid" : "invalid"}`} role="status">{validation.valid ? "Ready to print" : validation.errors.join(" ")}</span>
          <button type="button" className="secondary-button" onClick={() => { props.onToggle(); modelButton.current?.focus(); }}><Check size={14} /> Done</button>
        </div>
      </div>}
    </article>
  );
}
