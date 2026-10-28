import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ClipboardCheck, Copy, FileUp, Sparkles, TriangleAlert, X } from "lucide-react";
import { brandLogos, brandNames } from "../assets";
import { featureTooLong, mergeSpecs, parseSellingPointsReply, type SellingPointRow } from "../ai/parse";
import { buildSellingPointsPrompt } from "../ai/prompt";
import { PLATE_TYPES, type PlateType, type ShoeLabel, type ShoeSpecs } from "../types";
import { copyToClipboard } from "../utils/clipboard";
import { EMPTY_SPECS, MAX_FEATURE_LENGTH, PLATE_NAMES, specSegments } from "../utils/labels";

type Features = ShoeLabel["features"];
export interface SellingPointUpdate { id: string; features: Features; specs: ShoeSpecs }

interface AiPromptDialogProps {
  open: boolean;
  /** Every label; replies are matched against all of them, not only the selected ones. */
  allShoes: ShoeLabel[];
  /** The labels the prompt is written for. */
  selected: ShoeLabel[];
  onClose: () => void;
  onApply: (updates: SellingPointUpdate[]) => void;
}

const SLOT_LABELS = ["Type", "Drop", "Midsole foam"] as const;
const SLOT_PLACEHOLDERS = ["Race day", "8mm drop", "PWRRUN PB"] as const;

const SPEC_INPUTS = [
  { key: "heelStackMm", label: "Heel stack", unit: "mm", step: "0.5" },
  { key: "forefootStackMm", label: "Forefoot stack", unit: "mm", step: "0.5" },
  { key: "weightG", label: "Weight", unit: "g", step: "1" }
] as const;

const numberOrNull = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

interface RowEdit { features?: Features; specs?: ShoeSpecs; apply?: boolean }

export function AiPromptDialog(props: AiPromptDialogProps) {
  // Mounted only while open, so closing the dialog also clears the pasted reply.
  return props.open ? <AiPromptDialogBody {...props} /> : null;
}

function AiPromptDialogBody({ allShoes, selected, onClose, onApply }: AiPromptDialogProps) {
  const [tab, setTab] = useState<"prompt" | "import">(selected.length > 0 ? "prompt" : "import");
  const [reply, setReply] = useState("");
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const fileInput = useRef<HTMLInputElement>(null);

  const prompt = useMemo(() => buildSellingPointsPrompt(selected, allShoes), [selected, allShoes]);
  const outcome = useMemo(() => parseSellingPointsReply(reply, allShoes, selected), [reply, allShoes, selected]);
  const shoeById = useMemo(() => new Map(allShoes.map((shoe) => [shoe.id, shoe])), [allShoes]);

  // Slots the AI could not answer start out with what the label already says, so nothing is wiped by accident.
  const featuresOf = (row: SellingPointRow, shoe: ShoeLabel): Features =>
    edits[row.shoeId]?.features ?? (row.features.map((value, index) => value || shoe.features[index]) as Features);
  const specsOf = (row: SellingPointRow, shoe: ShoeLabel): ShoeSpecs =>
    edits[row.shoeId]?.specs ?? mergeSpecs(shoe.specs ?? EMPTY_SPECS, row.specs);
  const isChecked = (row: SellingPointRow) => edits[row.shoeId]?.apply ?? row.confidence !== "low";

  const applicable = outcome.rows.flatMap((row) => {
    const shoe = shoeById.get(row.shoeId);
    if (!shoe || !isChecked(row)) return [];
    const features = featuresOf(row, shoe);
    return features.some(featureTooLong) ? [] : [{ id: row.shoeId, features: features.map((value) => value.trim()) as Features, specs: specsOf(row, shoe) }];
  });

  const changeReply = (value: string) => { setReply(value); setEdits({}); };
  const patch = (id: string, next: RowEdit) => setEdits((current) => ({ ...current, [id]: { ...current[id], ...next } }));

  const copy = async () => {
    setCopied((await copyToClipboard(prompt)) ? "done" : "failed");
    window.setTimeout(() => setCopied("idle"), 2400);
  };

  return (
    <div className="modal-backdrop">
      <section className="modal ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-title">
        <header className="modal-header">
          <div>
            <span className="eyebrow">AI ASSISTANT</span>
            <h2 id="ai-title">Selling points from an AI tool</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>

        <nav className="ai-steps" aria-label="Steps">
          <button className={tab === "prompt" ? "is-current" : ""} onClick={() => setTab("prompt")}>
            <b>1</b> Copy the prompt
          </button>
          <ArrowRight size={15} />
          <button className={tab === "import" ? "is-current" : ""} onClick={() => setTab("import")}>
            <b>2</b> Import the reply
            {outcome.rows.length > 0 && <span className="ai-step-count">{outcome.rows.length}</span>}
          </button>
        </nav>

        <div className="modal-body ai-body">
          {tab === "prompt" ? (
            <>
              <p className="ai-lead">
                Paste this prompt into any AI tool (ChatGPT, Claude, Gemini…). It asks for three selling points per shoe —
                <strong> shoe type</strong>, <strong>drop</strong> and <strong>midsole foam</strong> — plus the <strong>stack height</strong>, <strong>weight</strong> and <strong>plate</strong> for the specs row, in a fixed format that this app can read back.
              </p>
              {selected.length === 0 ? (
                <div className="ai-empty">
                  <Sparkles size={22} />
                  <strong>No labels selected</strong>
                  <span>Close this window and tick the labels you want selling points for. Already have a reply? Go to step 2.</span>
                </div>
              ) : (
                <>
                  <ul className="ai-shoe-chips" aria-label="Labels in the prompt">
                    {selected.map((shoe) => (
                      <li key={shoe.id}><img src={brandLogos[shoe.brand]} alt="" />{brandNames[shoe.brand]} {shoe.model || <em>(no model)</em>}</li>
                    ))}
                  </ul>
                  <textarea className="ai-prompt-box" readOnly value={prompt} aria-label="Prompt for the AI tool" onFocus={(event) => event.currentTarget.select()} />
                </>
              )}
            </>
          ) : (
            <>
              <p className="ai-lead">
                Paste the AI tool's <strong>whole reply</strong> here. You can review and edit every selling point before anything changes on your labels.
              </p>
              <textarea
                className={`ai-reply-box ${outcome.rows.length > 0 ? "is-compact" : ""}`}
                value={reply}
                placeholder={'Paste the reply here, e.g.\n```json\n{ "labels": [ { "ref": "…", "category": "race", "dropMm": 8, … } ] }\n```'}
                aria-label="Reply from the AI tool"
                onChange={(event) => changeReply(event.target.value)}
              />
              <div className="ai-reply-tools">
                <button className="secondary-button" type="button" onClick={() => fileInput.current?.click()}><FileUp size={15} /> Open a saved reply…</button>
                {reply && <button className="secondary-button" type="button" onClick={() => changeReply("")}>Clear</button>}
                <input
                  ref={fileInput}
                  hidden
                  type="file"
                  accept=".json,.txt,.md,application/json,text/plain"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void file.text().then(changeReply);
                    event.target.value = "";
                  }}
                />
              </div>

              {outcome.error && <div className="ai-alert error" role="alert"><TriangleAlert size={16} />{outcome.error}</div>}
              {outcome.unmatched.length > 0 && (
                <div className="ai-alert warn"><TriangleAlert size={16} />Not matched to any label, skipped: {outcome.unmatched.join(", ")}</div>
              )}
              {outcome.rows.length > 0 && outcome.notReturned.length > 0 && (
                <div className="ai-alert warn">
                  <TriangleAlert size={16} />The reply has no entry for: {outcome.notReturned.map((shoe) => shoe.model || "unnamed label").join(", ")}
                </div>
              )}

              {outcome.rows.length > 0 && (
                <ul className="ai-review">
                  {outcome.rows.map((row) => {
                    const shoe = shoeById.get(row.shoeId);
                    if (!shoe) return null;
                    const features = featuresOf(row, shoe);
                    const specs = specsOf(row, shoe);
                    const currentSpecs = specSegments(shoe.specs);
                    const tooLong = features.some(featureTooLong);
                    const checked = isChecked(row) && !tooLong;
                    const current = shoe.features.map((value) => value.trim()).filter(Boolean);
                    return (
                      <li key={row.shoeId} className={`ai-row ${checked ? "" : "is-off"}`}>
                        <div className="ai-row-head">
                          <label>
                            <input type="checkbox" checked={checked} disabled={tooLong} onChange={(event) => patch(row.shoeId, { apply: event.target.checked })} />
                            <img src={brandLogos[shoe.brand]} alt="" />
                            <strong>{brandNames[shoe.brand]} {shoe.model || "(no model)"}</strong>
                          </label>
                          <span className={`ai-confidence ${row.confidence}`}>
                            {row.confidence === "low" ? "Low confidence — verify" : row.confidence === "medium" ? "Medium confidence" : "High confidence"}
                          </span>
                        </div>
                        <div className="ai-row-fields">
                          {SLOT_LABELS.map((slot, index) => {
                            const value = features[index];
                            const error = featureTooLong(value);
                            return (
                              <label key={slot} className={`field ${error ? "has-error" : ""} ${value.trim() ? "" : "needs-input"}`}>
                                <span>{slot}</span>
                                <input
                                  value={value}
                                  placeholder={row.features[index] ? SLOT_PLACEHOLDERS[index] : `Not found — ${SLOT_PLACEHOLDERS[index]}`}
                                  onChange={(event) => {
                                    const next = [...features] as Features;
                                    next[index] = event.target.value;
                                    patch(row.shoeId, { features: next });
                                  }}
                                />
                                <small className={error ? "count over" : "count"}>{value.trim().length}/{MAX_FEATURE_LENGTH}</small>
                              </label>
                            );
                          })}
                        </div>
                        <div className="ai-row-fields ai-spec-fields">
                          {SPEC_INPUTS.map(({ key, label, unit, step }) => (
                            <label key={key} className={`field ${specs[key] === null ? "needs-input" : ""}`}>
                              <span>{label}</span>
                              <input
                                type="number"
                                min="0"
                                step={step}
                                value={specs[key] ?? ""}
                                placeholder="Not found"
                                onChange={(event) => patch(row.shoeId, { specs: { ...specs, [key]: numberOrNull(event.target.value) } })}
                              />
                              <small className="count">{unit}</small>
                            </label>
                          ))}
                          <label className={`field ${row.specs.plate === null && !specs.plate ? "needs-input" : ""}`}>
                            <span>Plate</span>
                            <select value={specs.plate} onChange={(event) => patch(row.shoeId, { specs: { ...specs, plate: event.target.value as PlateType } })}>
                              <option value="">None</option>
                              {PLATE_TYPES.map((plate) => <option key={plate} value={plate}>{PLATE_NAMES[plate]}</option>)}
                            </select>
                          </label>
                        </div>
                        <p className="ai-row-meta">
                          <span>Now: {current.length > 0 ? current.join(" · ") : "no selling points"}{currentSpecs.length > 0 ? ` | ${currentSpecs.join(" · ")}` : ""}</span>
                          {row.notes && <span>AI note: {row.notes}</span>}
                          {row.matchedBy === "name" && <span>Matched by name</span>}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <footer className="modal-footer">
          {tab === "prompt" ? (
            <>
              <button className="secondary-button" onClick={onClose}>Close</button>
              <button className="primary-button" disabled={selected.length === 0} onClick={() => void copy()}>
                {copied === "done" ? <ClipboardCheck size={17} /> : <Copy size={17} />}
                {copied === "done" ? "Copied" : copied === "failed" ? "Copy failed — select the text" : "Copy prompt"}
              </button>
              <button className="secondary-button" onClick={() => setTab("import")}>I have the reply <ArrowRight size={15} /></button>
            </>
          ) : (
            <>
              <button className="secondary-button" onClick={onClose}>Cancel</button>
              <button className="primary-button" disabled={applicable.length === 0} onClick={() => { onApply(applicable); onClose(); }}>
                <Check size={17} /> Apply to {applicable.length} label{applicable.length === 1 ? "" : "s"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
