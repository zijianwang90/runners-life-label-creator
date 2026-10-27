import { CircleCheck, Download, ExternalLink, LoaderCircle, RefreshCw, TriangleAlert, X } from "lucide-react";
import type { UpdateChannel, UpdateInfo, UpdateState } from "../types";
import { formatBytes } from "../update/release";

interface UpdateDialogProps {
  open: boolean;
  state: UpdateState;
  onClose: () => void;
  onCheck: () => void;
  onInstall: () => void;
  onOpenReleasePage: () => void;
}

const HOW_IT_UPDATES: Record<UpdateChannel, string> = {
  portable: "This portable copy downloads the new version, replaces itself and restarts. Your labels and settings are kept.",
  installer: "The installer runs quietly in the background and the app restarts. Your labels and settings are kept.",
  manual: "This copy cannot update itself. Download the new version from the release page."
};

export function UpdateDialog(props: UpdateDialogProps) {
  if (!props.open) return null;
  const { state, onClose } = props;
  const { status } = state;
  const installing = status.state === "installing";
  const update = "update" in status ? status.update : undefined;

  return (
    <div className="modal-backdrop">
      <section className="modal update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
        <header className="modal-header">
          <div>
            <span className="eyebrow">SOFTWARE UPDATE</span>
            <h2 id="update-title">{update ? `Version ${update.version}` : "Updates"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} disabled={installing} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="modal-body update-body">
          <StatusBody {...props} />
          {update && update.notes && <ReleaseNotes update={update} />}
        </div>

        <footer className="modal-footer">
          <Actions {...props} />
        </footer>
      </section>
    </div>
  );
}

function StatusBody({ state }: UpdateDialogProps) {
  const { status, channel, currentVersion } = state;
  switch (status.state) {
    case "checking":
      return <p className="update-line"><LoaderCircle size={18} className="spin" /><span>Checking GitHub for a newer version…</span></p>;
    case "available":
      return (
        <>
          <p className="update-line"><Download size={18} /><span>Version <strong>{status.update.version}</strong> is available. You have <strong>{currentVersion}</strong>.</span></p>
          <p className="update-hint">{HOW_IT_UPDATES[channel]}{status.update.sizeBytes ? ` Download size: ${formatBytes(status.update.sizeBytes)}.` : ""}</p>
        </>
      );
    case "downloading": {
      const percent = status.totalBytes > 0 ? Math.min(100, Math.round((status.receivedBytes / status.totalBytes) * 100)) : 0;
      return (
        <>
          <p className="update-line"><LoaderCircle size={18} className="spin" /><span>Downloading version {status.update.version}… {percent}%</span></p>
          <div className="update-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
          <p className="update-hint">{formatBytes(status.receivedBytes)} of {formatBytes(status.totalBytes)}. The download is checked against the published checksum before it is installed.</p>
        </>
      );
    }
    case "installing":
      return <p className="update-line"><LoaderCircle size={18} className="spin" /><span>Installing version {status.update.version}. The app will close and reopen by itself.</span></p>;
    case "error":
      return <p className="update-line is-error"><TriangleAlert size={18} /><span>{status.message}</span></p>;
    case "up-to-date":
      return <p className="update-line is-ok"><CircleCheck size={18} /><span>You have the latest version (<strong>{currentVersion}</strong>).</span></p>;
    default:
      return <p className="update-line"><span>Version <strong>{currentVersion}</strong>.</span></p>;
  }
}

function ReleaseNotes({ update }: { update: UpdateInfo }) {
  return (
    <div className="update-notes">
      <h3>What is new</h3>
      <pre>{update.notes}</pre>
    </div>
  );
}

function Actions({ state, onClose, onCheck, onInstall, onOpenReleasePage }: UpdateDialogProps) {
  const { status, channel } = state;
  const selfUpdates = channel !== "manual";
  switch (status.state) {
    case "available":
      return (
        <>
          <button className="secondary-button" onClick={onClose}>Later</button>
          {selfUpdates && <button className="secondary-button" onClick={onOpenReleasePage}><ExternalLink size={16} /> Release page</button>}
          <button className="primary-button" onClick={selfUpdates ? onInstall : onOpenReleasePage}>
            {selfUpdates ? <><Download size={17} /> Update and restart</> : <><ExternalLink size={17} /> Open release page</>}
          </button>
        </>
      );
    case "downloading":
      return <button className="secondary-button" onClick={onClose}>Hide</button>;
    case "installing":
      return <button className="secondary-button" disabled>Restarting…</button>;
    case "error":
      return (
        <>
          <button className="secondary-button" onClick={onClose}>Close</button>
          <button className="secondary-button" onClick={onOpenReleasePage}><ExternalLink size={16} /> Release page</button>
          <button className="primary-button" onClick={status.update ? onInstall : onCheck}><RefreshCw size={16} /> Try again</button>
        </>
      );
    case "checking":
      return <button className="secondary-button" onClick={onClose}>Close</button>;
    default:
      return (
        <>
          <button className="secondary-button" onClick={onClose}>Close</button>
          <button className="primary-button" onClick={onCheck}><RefreshCw size={16} /> Check again</button>
        </>
      );
  }
}
