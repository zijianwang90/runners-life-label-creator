import { useEffect, useRef, type FormEvent } from "react";
import { Printer, X } from "lucide-react";
import type { GiftCertificate } from "../types";
import { certificateError, todayReference } from "../utils/giftCertificate";
import { GiftCertificateSvg } from "./GiftCertificateSvg";

interface GiftCertificateDialogProps {
  certificate: GiftCertificate;
  printing: boolean;
  onChange: (certificate: GiftCertificate) => void;
  onClose: () => void;
  onPrint: () => void;
}

export function GiftCertificateDialog({ certificate, printing, onChange, onClose, onPrint }: GiftCertificateDialogProps) {
  const dialog = useRef<HTMLElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const error = certificateError(certificate);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    amountInput.current?.focus();
    return () => previous?.focus();
  }, []);

  const update = (patch: Partial<GiftCertificate>) => onChange({ ...certificate, ...patch });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!printing && !error) onPrint();
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!printing) onClose(); }}>
      <section ref={dialog} className="modal gift-dialog" role="dialog" aria-modal="true" aria-labelledby="gift-title" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); if (!printing) onClose(); }
        if ((event.ctrlKey || event.metaKey) && ["p", "n"].includes(event.key.toLowerCase())) {
          event.preventDefault(); event.stopPropagation();
          if (event.key.toLowerCase() === "p" && !printing && !error) onPrint();
        }
        if (event.key === "Tab") {
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
          const first = controls[0]; const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <header className="modal-header">
          <div><span className="eyebrow">IN-STORE PRINT</span><h2 id="gift-title">Gift certificate</h2></div>
          <button className="icon-button" disabled={printing} onClick={onClose} aria-label="Close gift certificate"><X size={20} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="gift-dialog-body">
            <fieldset className="gift-fields" disabled={printing}>
              <label className="field" htmlFor="gift-amount"><span>Amount (required)</span></label>
              <div className="gift-amount-row">
                <div className="gift-amount-input"><span>$</span><input ref={amountInput} id="gift-amount" inputMode="decimal" autoComplete="off" value={certificate.amount} maxLength={9} onChange={(event) => update({ amount: event.target.value })} placeholder="0.00" required /></div>
                {[50, 100, 200].map((amount) => <button key={amount} type="button" className={Number(certificate.amount) === amount ? "primary-button" : "secondary-button"} aria-pressed={Number(certificate.amount) === amount} onClick={() => update({ amount: String(amount) })}>${amount}</button>)}
              </div>
              <label className="field"><span>To (customer)</span><input value={certificate.to} maxLength={60} onChange={(event) => update({ to: event.target.value })} placeholder="Optional — leave blank to handwrite" /></label>
              <label className="field"><span>From</span><input value={certificate.from} maxLength={60} onChange={(event) => update({ from: event.target.value })} placeholder="Optional" /></label>
              <label className="field"><span>Signature (issued by)</span><input value={certificate.signer} maxLength={60} onChange={(event) => update({ signer: event.target.value })} placeholder="Optional — leave blank to sign by hand" /></label>
              <label className="field" htmlFor="gift-ref"><span>Ref # (required)</span></label>
              <div className="gift-ref-row"><input id="gift-ref" value={certificate.ref} maxLength={40} required onChange={(event) => update({ ref: event.target.value })} /><button type="button" className="secondary-button" onClick={() => update({ ref: todayReference() })}>Today</button></div>
              <p className="gift-help">Empty fields keep their label and blank line for handwriting. Ref # defaults to today’s date; edit it for multiple certificates on the same day.</p>
              {error && certificate.amount && <p className="gift-error" role="status">{error}</p>}
            </fieldset>
            <div className="gift-preview"><GiftCertificateSvg certificate={certificate} /></div>
          </div>
          <footer className="modal-footer">
            <p className="gift-help">Letter · Preview and print inside the app.<br />Click the PDF printer icon. Use Letter paper at 100% scale.</p>
            <button className="secondary-button" type="button" disabled={printing} onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit" disabled={printing || !!error}><Printer size={17} />{printing ? "Creating PDF…" : "Create PDF to print"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
