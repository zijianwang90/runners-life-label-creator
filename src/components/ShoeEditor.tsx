import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import { brandLogos, brandNames } from "../assets";
import { BRAND_IDS, type ShoeLabel } from "../types";
import { getPriceState, validateShoe } from "../utils/labels";

interface ShoeEditorProps {
  shoe: ShoeLabel;
  index: number;
  selected: boolean;
  active: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: (selected: boolean) => void;
  onActivate: () => void;
  onChange: (next: ShoeLabel) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}

const numericValue = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function ShoeEditor(props: ShoeEditorProps) {
  const { shoe } = props;
  const validation = validateShoe(shoe);
  const update = (patch: Partial<ShoeLabel>) => props.onChange({ ...shoe, ...patch, updatedAt: new Date().toISOString() });
  const priceState = getPriceState(shoe);

  return (
    <article className={`shoe-card ${props.active ? "is-active" : ""}`} onClick={props.onActivate}>
      <div className="shoe-card-index">
        <input
          type="checkbox"
          checked={props.selected}
          onChange={(event) => props.onSelect(event.target.checked)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Add ${shoe.model || `shoe ${props.index + 1}`} to print cart`}
        />
        <span>{String(props.index + 1).padStart(2, "0")}</span>
      </div>

      <div className="shoe-card-main">
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

        </div>

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
      </div>

      <div className="shoe-card-actions">
        <span className={`state-pill ${priceState}`}>{priceState === "sale" ? "SALE" : "REGULAR"}</span>
        <button className="icon-button" title="Move up" disabled={!props.canMoveUp} onClick={(event) => { event.stopPropagation(); props.onMove(-1); }}><ArrowUp size={16} /></button>
        <button className="icon-button" title="Move down" disabled={!props.canMoveDown} onClick={(event) => { event.stopPropagation(); props.onMove(1); }}><ArrowDown size={16} /></button>
        <button className="icon-button" title="Duplicate" onClick={(event) => { event.stopPropagation(); props.onDuplicate(); }}><Copy size={16} /></button>
        <button className="icon-button danger" title="Delete" onClick={(event) => { event.stopPropagation(); props.onDelete(); }}><Trash2 size={16} /></button>
        <span className={`validation-dot ${validation.valid ? "valid" : "invalid"}`} title={validation.valid ? "Ready to print" : validation.errors.join(" ")} />
      </div>
    </article>
  );
}
