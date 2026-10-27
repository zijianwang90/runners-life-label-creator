import { FileDown, Minus, Plus, Printer, Ruler, Trash2, X } from "lucide-react";
import type { AppSettings, PrinterInfoLite, ShoeLabel } from "../types";
import { SAVE_PDF_PRINTER } from "../types";
import { expandLabelCopies } from "../utils/labels";
import { a4Layout, formatLabelSize } from "../utils/labelSize";
import { LabelSvg } from "./LabelSvg";

interface PrintDialogProps {
  open: boolean;
  shoes: ShoeLabel[];
  settings: AppSettings;
  printers: PrinterInfoLite[];
  loadingPrinters: boolean;
  printing: boolean;
  onClose: () => void;
  onShoesChange: (shoes: ShoeLabel[]) => void;
  onRemoveFromSelection: (id: string) => void;
  onSettingsChange: (settings: AppSettings) => void;
  onPrint: () => void;
  onCalibrationPrint: () => void;
}

export function PrintDialog(props: PrintDialogProps) {
  if (!props.open) return null;
  const copies = expandLabelCopies(props.shoes).length;
  const size = props.settings.labelSize;
  const perSheet = a4Layout(size).perPage;
  const sizeText = formatLabelSize(size);
  const savingPdf = props.settings.printerName === SAVE_PDF_PRINTER;
  const update = (patch: Partial<AppSettings>) => props.onSettingsChange({ ...props.settings, ...patch });
  const updateCalibration = (patch: Partial<AppSettings["calibration"]>) => update({ calibration: { ...props.settings.calibration, ...patch } });
  const number = (value: string, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const setQuantity = (id: string, quantity: number) => {
    const safeQuantity = Math.max(1, Math.min(99, Math.round(quantity) || 1));
    props.onShoesChange(props.shoes.map((shoe) => shoe.id === id ? { ...shoe, quantity: safeQuantity } : shoe));
  };
  const remove = (id: string) => {
    props.onShoesChange(props.shoes.filter((shoe) => shoe.id !== id));
    props.onRemoveFromSelection(id);
  };

  return (
    <div className="modal-backdrop" onMouseDown={props.onClose}>
      <section className="modal print-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="print-title">
        <header className="modal-header">
          <div><span className="eyebrow">{savingPdf ? "PDF EXPORT" : "PRINT JOB"}</span><h2 id="print-title">{savingPdf ? "Save" : "Print"} {copies} label{copies === 1 ? "" : "s"}{savingPdf ? " as PDF" : ""}</h2></div>
          <button className="icon-button" onClick={props.onClose} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="print-summary">
          <div><strong>{props.shoes.length}</strong><span>shoe models</span></div>
          <div><strong>{copies}</strong><span>physical labels</span></div>
          <div><strong>{props.settings.printMode === "a4" ? Math.ceil(copies / perSheet) : copies}</strong><span>{props.settings.printMode === "a4" ? "A4 sheets" : "print pages"}</span></div>
        </div>

        <div className="modal-body">
          <section className="print-cart-section">
            <div className="section-heading">
              <div><span className="eyebrow">SELECTED LABELS</span><h3>Print cart</h3></div>
              <span>{props.shoes.length} model{props.shoes.length === 1 ? "" : "s"}</span>
            </div>
            <div className="print-cart-list">
              {props.shoes.map((shoe) => (
                <article className="print-cart-item" key={shoe.id}>
                  <div className="cart-label-preview"><LabelSvg shoe={shoe} currencySymbol={props.settings.currencySymbol} size={size} /></div>
                  <div className="cart-item-controls">
                    <span>Copies</span>
                    <div className="quantity-stepper">
                      <button type="button" aria-label={`Decrease ${shoe.model} copies`} disabled={shoe.quantity <= 1} onClick={() => setQuantity(shoe.id, shoe.quantity - 1)}><Minus size={15} /></button>
                      <input aria-label={`${shoe.model} print copies`} type="number" min="1" max="99" value={shoe.quantity} onChange={(event) => setQuantity(shoe.id, Number(event.target.value))} />
                      <button type="button" aria-label={`Increase ${shoe.model} copies`} disabled={shoe.quantity >= 99} onClick={() => setQuantity(shoe.id, shoe.quantity + 1)}><Plus size={15} /></button>
                    </div>
                    <button className="remove-cart-item" type="button" onClick={() => remove(shoe.id)}><Trash2 size={14} /> Remove</button>
                  </div>
                </article>
              ))}
              {props.shoes.length === 0 && <div className="empty-print-cart">No labels selected. Close this window and add shoes to the print cart.</div>}
            </div>
          </section>

          <fieldset className="print-mode-grid">
            <legend>Paper layout</legend>
            <label className={props.settings.printMode === "a4" ? "selected" : ""}>
              <input type="radio" name="mode" checked={props.settings.printMode === "a4"} onChange={() => update({ printMode: "a4" })} />
              <strong>A4 landscape</strong><span>{perSheet} labels per sheet with crop marks</span>
            </label>
            <label className={props.settings.printMode === "custom" ? "selected" : ""}>
              <input type="radio" name="mode" checked={props.settings.printMode === "custom"} onChange={() => update({ printMode: "custom" })} />
              <strong>{sizeText}</strong><span>One label per page for label printers</span>
            </label>
          </fieldset>

          <label className="field full-field">
            <span>Printer</span>
            <select value={props.settings.printerName} disabled={props.loadingPrinters} onChange={(event) => update({ printerName: event.target.value })}>
              <option value="">{props.loadingPrinters ? "Loading printers…" : "System default printer"}</option>
              <option value={SAVE_PDF_PRINTER}>Save as PDF — local file</option>
              {props.printers.map((printer) => <option key={printer.name} value={printer.name}>{printer.displayName}{printer.isDefault ? " (Default)" : ""}</option>)}
            </select>
          </label>

          {savingPdf ? (
            <div className="pdf-save-note"><FileDown size={17} /><span><strong>Save locally as PDF</strong><small>You will choose the file name and folder after clicking Save PDF.</small></span></div>
          ) : (
            <label className="toggle-row">
              <input type="checkbox" checked={props.settings.useSystemDialog} onChange={(event) => update({ useSystemDialog: event.target.checked })} />
              <span><strong>Show Windows print dialog</strong><small>Recommended for the first print on each printer.</small></span>
            </label>
          )}

          <details className="calibration-box">
            <summary><Ruler size={17} /> Printer calibration</summary>
            <p>Use small corrections only after measuring a printed {sizeText} test label.</p>
            <div className="calibration-grid">
              <label><span>Width scale</span><input type="number" min="0.95" max="1.05" step="0.001" value={props.settings.calibration.scaleX} onChange={(event) => updateCalibration({ scaleX: number(event.target.value, 1) })} /></label>
              <label><span>Height scale</span><input type="number" min="0.95" max="1.05" step="0.001" value={props.settings.calibration.scaleY} onChange={(event) => updateCalibration({ scaleY: number(event.target.value, 1) })} /></label>
              <label><span>X offset (mm)</span><input type="number" min="-5" max="5" step="0.1" value={props.settings.calibration.offsetXmm} onChange={(event) => updateCalibration({ offsetXmm: number(event.target.value, 0) })} /></label>
              <label><span>Y offset (mm)</span><input type="number" min="-5" max="5" step="0.1" value={props.settings.calibration.offsetYmm} onChange={(event) => updateCalibration({ offsetYmm: number(event.target.value, 0) })} /></label>
            </div>
            <div className="calibration-actions">
              <button className="secondary-button" onClick={() => updateCalibration({ scaleX: 1, scaleY: 1, offsetXmm: 0, offsetYmm: 0 })}>Reset</button>
              <button className="secondary-button" onClick={props.onCalibrationPrint} disabled={props.printing}><Ruler size={16} /> {savingPdf ? "Save calibration PDF" : "Print calibration"}</button>
            </div>
          </details>
        </div>

        <footer className="modal-footer">
          <button className="secondary-button" onClick={props.onClose}>Cancel</button>
          <button className="primary-button" onClick={props.onPrint} disabled={props.printing || copies === 0}>
            {savingPdf ? <FileDown size={17} /> : <Printer size={17} />} {props.printing ? (savingPdf ? "Creating PDF…" : "Sending to printer…") : (savingPdf ? "Save PDF" : "Print labels")}
          </button>
        </footer>
      </section>
    </div>
  );
}
