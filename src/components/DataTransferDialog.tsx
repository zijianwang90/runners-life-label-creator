import { Download, Upload, X } from "lucide-react";

interface DataTransferDialogProps {
  open: boolean;
  labelCount: number;
  busy: "export" | "import" | null;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function DataTransferDialog(props: DataTransferDialogProps) {
  if (!props.open) return null;
  const busy = props.busy !== null;

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!busy) props.onClose(); }}>
      <section className="modal data-dialog" role="dialog" aria-modal="true" aria-labelledby="data-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="eyebrow">DATA BACKUP</span>
            <h2 id="data-title">Export and import data</h2>
          </div>
          <button className="icon-button" onClick={props.onClose} disabled={busy} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="modal-body data-transfer-body">
          <p className="data-transfer-intro">
            Move {props.labelCount === 1 ? "your label" : `all ${props.labelCount} labels`}, the print list and every setting to another computer with one file.
          </p>

          <section className="data-transfer-option">
            <span className="data-transfer-icon"><Download size={20} /></span>
            <div>
              <h3>Export data</h3>
              <p>Save a backup file that can be imported on the other computer.</p>
            </div>
            <button className="primary-button" onClick={props.onExport} disabled={busy}>
              <Download size={16} /> {props.busy === "export" ? "Exporting…" : "Export data"}
            </button>
          </section>

          <section className="data-transfer-option">
            <span className="data-transfer-icon"><Upload size={20} /></span>
            <div>
              <h3>Import data</h3>
              <p>Choose an exported file. You can review the confirmation before this computer's labels are replaced.</p>
            </div>
            <button className="secondary-button" onClick={props.onImport} disabled={busy}>
              <Upload size={16} /> {props.busy === "import" ? "Importing…" : "Import data"}
            </button>
          </section>

          <p className="data-transfer-note">The file stays on your computer. Nothing is uploaded.</p>
        </div>

        <footer className="modal-footer">
          <button className="secondary-button" onClick={props.onClose} disabled={busy}>Close</button>
        </footer>
      </section>
    </div>
  );
}
