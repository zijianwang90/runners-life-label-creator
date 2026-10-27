import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, LoaderCircle, Plus, Search, Settings2, Tags, TriangleAlert, X } from "lucide-react";
import { brandNames } from "./assets";
import { createDefaultData, createEmptyShoe, normalizeAppData } from "./data";
import { AiPromptDialog, type SellingPointUpdate } from "./components/AiPromptDialog";
import { PreviewPanel } from "./components/PreviewPanel";
import { PrintDialog } from "./components/PrintDialog";
import { SelectionBar } from "./components/SelectionBar";
import { ShoeEditor } from "./components/ShoeEditor";
import { UpdateDialog } from "./components/UpdateDialog";
import type { AppData, AppSettings, BrandId, LabelSize, ShoeLabel, TextScales, UpdateStatus } from "./types";
import { BRAND_IDS } from "./types";
import { validateShoe } from "./utils/labels";
import { formatLabelSize } from "./utils/labelSize";
import { useUpdater } from "./update/useUpdater";

const appIconUrl = `${import.meta.env.BASE_URL}app-icon.svg`;

type SaveState = "loading" | "saving" | "saved" | "error";

interface ToastState { message: string; tone: "success" | "error" | "info" }

async function loadData(): Promise<AppData> {
  if (window.electronAPI) {
    const stored = await window.electronAPI.loadData();
    return stored ? normalizeAppData(stored) : createDefaultData();
  }
  const stored = localStorage.getItem("runners-life-labels");
  return stored ? normalizeAppData(JSON.parse(stored)) : createDefaultData();
}

async function saveData(data: AppData): Promise<void> {
  if (window.electronAPI) await window.electronAPI.saveData(data);
  else localStorage.setItem("runners-life-labels", JSON.stringify(data));
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [activeId, setActiveId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<BrandId | "all">("all");
  const [printOpen, setPrintOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [printQueue, setPrintQueue] = useState<ShoeLabel[]>([]);
  const [printing, setPrinting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [updateOpen, setUpdateOpen] = useState(false);
  const updater = useUpdater();
  const announcedUpdate = useRef("");
  const initialized = useRef(false);

  const showToast = useCallback((message: string, tone: ToastState["tone"] = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3400);
  }, []);

  useEffect(() => {
    void loadData().then((loaded) => {
      setData(loaded);
      setActiveId(loaded.shoes[0]?.id ?? "");
      setSaveState("saved");
      initialized.current = true;
    }).catch((error) => {
      setData(createDefaultData());
      setSaveState("error");
      initialized.current = true;
      showToast(error instanceof Error ? error.message : "Could not load saved labels.", "error");
    });
    if (window.electronAPI) void window.electronAPI.getAppVersion().then(setAppVersion);
  }, [showToast]);

  // Mention a new release once per version; the header button stays until it is dealt with.
  const updateStatus = updater.state?.status;
  useEffect(() => {
    if (updateStatus?.state !== "available" || announcedUpdate.current === updateStatus.update.version) return;
    announcedUpdate.current = updateStatus.update.version;
    showToast(`Version ${updateStatus.update.version} is available. Use the Update button at the top.`, "info");
  }, [updateStatus, showToast]);

  const openUpdates = () => {
    setUpdateOpen(true);
    const busy = updateStatus && ["checking", "available", "downloading", "installing"].includes(updateStatus.state);
    if (!busy) updater.check();
  };

  useEffect(() => {
    if (!data || !initialized.current) return;
    setSaveState("saving");
    void saveData(data).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
  }, [data]);

  const shoes = data?.shoes ?? [];
  const filteredShoes = useMemo(() => shoes.filter((shoe) => {
    const matchesBrand = brandFilter === "all" || shoe.brand === brandFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || shoe.model.toLowerCase().includes(query) || brandNames[shoe.brand].toLowerCase().includes(query);
    return matchesBrand && matchesSearch;
  }), [shoes, brandFilter, search]);
  const selectedShoes = useMemo(() => shoes.filter((shoe) => selectedIds.has(shoe.id)), [shoes, selectedIds]);
  const activeShoe = shoes.find((shoe) => shoe.id === activeId) ?? shoes[0] ?? null;
  const validCount = shoes.filter((shoe) => validateShoe(shoe).valid).length;
  const saleCount = shoes.filter((shoe) => shoe.salePrice !== null && shoe.regularPrice !== null && shoe.salePrice < shoe.regularPrice).length;

  const updateShoes = (nextShoes: ShoeLabel[]) => setData((current) => current ? { ...current, shoes: nextShoes } : current);
  const updateSettings = (settings: AppSettings) => setData((current) => current ? { ...current, settings } : current);
  const updateLabelSize = (labelSize: LabelSize) => setData((current) => current ? { ...current, settings: { ...current.settings, labelSize } } : current);
  const updateTextScales = (scales: Partial<TextScales>) => setData((current) => current ? { ...current, settings: { ...current.settings, ...scales } } : current);

  const addShoe = useCallback(() => {
    const shoe = createEmptyShoe();
    setData((current) => current ? { ...current, shoes: [...current.shoes, shoe] } : current);
    setActiveId(shoe.id);
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-shoe-id="${shoe.id}"] input`)?.focus(), 50);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault(); addShoe();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault(); void openPrintDialog();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addShoe, data, selectedIds, shoes, showToast]);

  const updateShoe = (id: string, next: ShoeLabel) => updateShoes(shoes.map((shoe) => shoe.id === id ? next : shoe));
  const duplicateShoe = (source: ShoeLabel) => {
    const now = new Date().toISOString();
    const copy: ShoeLabel = { ...structuredClone(source), id: crypto.randomUUID(), model: `${source.model} COPY`.trim(), createdAt: now, updatedAt: now };
    const index = shoes.findIndex((shoe) => shoe.id === source.id);
    const next = [...shoes]; next.splice(index + 1, 0, copy); updateShoes(next); setActiveId(copy.id);
  };
  const deleteShoe = (id: string) => {
    const shoe = shoes.find((item) => item.id === id);
    if (!shoe || !window.confirm(`Delete ${shoe.model || "this shoe label"}?`)) return;
    const next = shoes.filter((item) => item.id !== id);
    updateShoes(next.length ? next : [createEmptyShoe()]);
    setSelectedIds((current) => { const updated = new Set(current); updated.delete(id); return updated; });
    if (activeId === id) setActiveId(next[0]?.id ?? "");
  };
  const moveShoe = (id: string, direction: -1 | 1) => {
    const index = shoes.findIndex((shoe) => shoe.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= shoes.length) return;
    const next = [...shoes]; [next[index], next[target]] = [next[target], next[index]]; updateShoes(next);
  };

  const applySellingPoints = (updates: SellingPointUpdate[]) => {
    if (updates.length === 0) return;
    const byId = new Map(updates.map((update) => [update.id, update.features]));
    const now = new Date().toISOString();
    updateShoes(shoes.map((shoe) => byId.has(shoe.id) ? { ...shoe, features: byId.get(shoe.id)!, updatedAt: now } : shoe));
    setActiveId(updates[0].id);
    showToast(`Selling points updated on ${updates.length} label${updates.length === 1 ? "" : "s"}.`, "success");
  };

  const toggleAllVisible = () => {
    const visibleIds = filteredShoes.map((shoe) => shoe.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  function openPrintDialog() {
    if (!data) return;
    const candidates = shoes.filter((shoe) => selectedIds.has(shoe.id));
    if (candidates.length === 0) {
      showToast("Select at least one shoe label to add it to the print cart.", "info");
      return;
    }
    const invalid = candidates.find((shoe) => !validateShoe(shoe).valid);
    if (invalid) {
      setActiveId(invalid.id);
      showToast(`Complete ${invalid.model || "the highlighted label"} before printing.`, "error");
      return;
    }
    setPrintQueue(candidates.map((shoe) => ({ ...structuredClone(shoe), quantity: 1 })));
    setPrintOpen(true);
  }

  async function runPrint(kind: "labels" | "calibration") {
    if (!data || !window.electronAPI) {
      showToast("Printing is available in the desktop application.", "error");
      return;
    }
    setPrinting(true);
    try {
      const result = await window.electronAPI.print({
        kind,
        labels: kind === "labels" ? printQueue : [],
        mode: data.settings.printMode,
        currencySymbol: data.settings.currencySymbol,
        labelSize: data.settings.labelSize,
        modelTextScale: data.settings.modelTextScale,
        featureTextScale: data.settings.featureTextScale,
        priceTextScale: data.settings.priceTextScale,
        regularPriceTextScale: data.settings.regularPriceTextScale,
        saleSealScale: data.settings.saleSealScale,
        calibration: data.settings.calibration
      });
      if (result.success) {
        showToast(`${kind === "labels" ? "Labels" : "Calibration page"} saved as a PDF — it is selected in the folder that just opened. Drag it into Chrome and print with Scale set to Actual size.`, "success");
        if (kind === "labels") {
          setPrintOpen(false);
          setSelectedIds(new Set());
          setPrintQueue([]);
        }
      } else showToast(result.reason || "Could not create the PDF.", "error");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not create the PDF.", "error");
    } finally { setPrinting(false); }
  }

  if (!data) return <div className="app-loading"><div className="loading-mark" /><p>Loading label workspace…</p></div>;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand"><img src={appIconUrl} alt="Runners Life" /><div><strong>Label Creator</strong><span>SHOE WALL SYSTEM</span></div></div>
        <div className="header-actions">
          <UpdateButton status={updateStatus} onClick={openUpdates} />
          <span className={`save-state ${saveState}`}><Check size={14} />{saveState === "saving" ? "Saving…" : saveState === "error" ? "Save error" : "Saved locally"}</span>
        </div>
      </header>

      <section className="dashboard-strip">
        <div><Tags size={19} /><strong>{shoes.length}</strong><span>shoe models</span></div>
        <div><strong>{validCount}</strong><span>ready to print</span></div>
        <div><strong>{saleCount}</strong><span>sale labels</span></div>
        <div className="currency-setting"><Settings2 size={16} /><label>Currency <input value={data.settings.currencySymbol} maxLength={3} onChange={(event) => updateSettings({ ...data.settings, currencySymbol: event.target.value || "$" })} /></label></div>
      </section>

      <main className="workspace">
        <section className="editor-pane">
          <div className="list-toolbar">
            <div className="search-box"><Search size={17} /><input value={search} placeholder="Search model or brand" onChange={(event) => setSearch(event.target.value)} />{search && <button onClick={() => setSearch("")}><X size={15} /></button>}</div>
            <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value as BrandId | "all")}>
              <option value="all">All brands</option>{BRAND_IDS.map((brand) => <option key={brand} value={brand}>{brandNames[brand]}</option>)}
            </select>
            <span className="result-count">{filteredShoes.length} shown</span>
            <button className="primary-button add-button" onClick={addShoe}><Plus size={17} /> Add shoe</button>
          </div>

          <SelectionBar
            shownCount={filteredShoes.length}
            selectedCount={selectedIds.size}
            selectedShownCount={filteredShoes.filter((shoe) => selectedIds.has(shoe.id)).length}
            onToggleShown={toggleAllVisible}
            onClear={() => setSelectedIds(new Set())}
            onAi={() => setAiOpen(true)}
            onPrint={() => void openPrintDialog()}
          />

          <div className="shoe-list">
            {filteredShoes.length === 0 ? (
              <div className="empty-state"><Search size={30} /><h3>No matching shoes</h3><p>Clear the filters or add a new shoe label.</p></div>
            ) : filteredShoes.map((shoe) => {
              const globalIndex = shoes.findIndex((item) => item.id === shoe.id);
              return (
                <div key={shoe.id} data-shoe-id={shoe.id}>
                  <ShoeEditor
                    shoe={shoe}
                    index={globalIndex}
                    active={activeId === shoe.id}
                    selected={selectedIds.has(shoe.id)}
                    canMoveUp={globalIndex > 0}
                    canMoveDown={globalIndex < shoes.length - 1}
                    onActivate={() => setActiveId(shoe.id)}
                    onSelect={(selected) => setSelectedIds((current) => { const next = new Set(current); selected ? next.add(shoe.id) : next.delete(shoe.id); return next; })}
                    onChange={(next) => updateShoe(shoe.id, next)}
                    onDuplicate={() => duplicateShoe(shoe)}
                    onDelete={() => deleteShoe(shoe.id)}
                    onMove={(direction) => moveShoe(shoe.id, direction)}
                  />
                </div>
              );
            })}
          </div>
        </section>
        <PreviewPanel shoe={activeShoe} currencySymbol={data.settings.currencySymbol} labelSize={data.settings.labelSize} onLabelSizeChange={updateLabelSize} textScales={data.settings} onTextScalesChange={updateTextScales} />
      </main>

      <footer className="app-footer"><span>Runners Life Label Creator v{appVersion}{updater.state && <> · <button className="link-button" onClick={openUpdates}>Check for updates</button></>}</span><span>Offline data · {formatLabelSize(data.settings.labelSize)} label · approved Scheme A system</span></footer>
      <PrintDialog
        open={printOpen}
        shoes={printQueue}
        settings={data.settings}
        printing={printing}
        onClose={() => { if (!printing) { setPrintOpen(false); setPrintQueue([]); } }}
        onShoesChange={setPrintQueue}
        onRemoveFromSelection={(id) => setSelectedIds((current) => { const next = new Set(current); next.delete(id); return next; })}
        onSettingsChange={updateSettings}
        onPrint={() => void runPrint("labels")}
        onCalibrationPrint={() => void runPrint("calibration")}
      />
      <AiPromptDialog open={aiOpen} allShoes={shoes} selected={selectedShoes} onClose={() => setAiOpen(false)} onApply={applySellingPoints} />
      {updater.state && (
        <UpdateDialog
          open={updateOpen}
          state={updater.state}
          onClose={() => setUpdateOpen(false)}
          onCheck={updater.check}
          onInstall={updater.install}
          onOpenReleasePage={updater.openReleasePage}
        />
      )}
      {toast && <div className={`toast ${toast.tone}`}>{toast.message}</div>}
    </div>
  );
}

/** Shows up in the header only while there is something to do about an update. */
function UpdateButton({ status, onClick }: { status: UpdateStatus | undefined; onClick: () => void }) {
  if (!status) return null;
  if (status.state === "available") return <button className="update-pill" onClick={onClick}><Download size={14} /> Update to {status.update.version}</button>;
  if (status.state === "downloading") return <button className="update-pill is-busy" onClick={onClick}><LoaderCircle size={14} className="spin" /> Downloading…</button>;
  if (status.state === "installing") return <button className="update-pill is-busy" onClick={onClick}><LoaderCircle size={14} className="spin" /> Restarting…</button>;
  if (status.state === "error" && status.update) return <button className="update-pill is-error" onClick={onClick}><TriangleAlert size={14} /> Update failed</button>;
  return null;
}
