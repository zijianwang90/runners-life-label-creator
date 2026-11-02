import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Gift, LoaderCircle, Plus, Search, Tags, TriangleAlert, X } from "lucide-react";
import { brandNames } from "./assets";
import { createDefaultData, createEmptyShoe, normalizeAppData } from "./data";
import { AiPromptDialog, type SellingPointUpdate } from "./components/AiPromptDialog";
import { PreviewPanel } from "./components/PreviewPanel";
import { PrintDialog } from "./components/PrintDialog";
import { GiftCertificateDialog } from "./components/GiftCertificateDialog";
import { certificateError, createGiftCertificate } from "./utils/giftCertificate";
import { SelectionBar } from "./components/SelectionBar";
import { ShoeEditor } from "./components/ShoeEditor";
import { UpdateDialog } from "./components/UpdateDialog";
import type { AppData, AppSettings, BrandId, GiftCertificate, LabelSize, PrintCartItem, ShoeLabel, TextScales, UpdateStatus } from "./types";
import { BRAND_IDS } from "./types";
import { addToCart, cartCopyCount, cartLabels, removeFromCart, setCartCopies } from "./utils/cart";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<BrandId | "all">("all");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [certificate, setCertificate] = useState<GiftCertificate | null>(null);
  const giftPrintPending = useRef(false);
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
  const incompleteIds = useMemo(() => new Set(shoes.filter((shoe) => !validateShoe(shoe).valid).map((shoe) => shoe.id)), [shoes]);
  // The open label stays listed so it doesn't vanish the moment its last field is fixed.
  const filteredShoes = useMemo(() => shoes.filter((shoe) => {
    if (incompleteOnly && !incompleteIds.has(shoe.id) && shoe.id !== expandedId) return false;
    const matchesBrand = brandFilter === "all" || shoe.brand === brandFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || shoe.model.toLowerCase().includes(query) || brandNames[shoe.brand].toLowerCase().includes(query);
    return matchesBrand && matchesSearch;
  }), [shoes, brandFilter, search, incompleteOnly, incompleteIds, expandedId]);
  const printCart = data?.printCart ?? [];
  const printQueue = useMemo(() => cartLabels(printCart, shoes), [printCart, shoes]);
  const cartCopiesById = useMemo(() => new Map(printCart.map((item) => [item.id, item.copies])), [printCart]);
  const selectedShoes = useMemo(() => shoes.filter((shoe) => selectedIds.has(shoe.id)), [shoes, selectedIds]);
  const activeShoe = shoes.find((shoe) => shoe.id === activeId) ?? shoes[0] ?? null;
  const validCount = shoes.length - incompleteIds.size;
  const saleCount = shoes.filter((shoe) => shoe.salePrice !== null && shoe.regularPrice !== null && shoe.salePrice < shoe.regularPrice).length;

  const updateShoes = (nextShoes: ShoeLabel[]) => setData((current) => current ? { ...current, shoes: nextShoes } : current);
  const updateCart = (change: (cart: PrintCartItem[]) => PrintCartItem[]) =>
    setData((current) => current ? { ...current, printCart: change(current.printCart) } : current);
  const updateSettings = (settings: AppSettings) => setData((current) => current ? { ...current, settings } : current);
  const updateLabelSize = (labelSize: LabelSize) => setData((current) => current ? { ...current, settings: { ...current.settings, labelSize } } : current);
  const updateTextScales = (scales: Partial<TextScales>) => setData((current) => current ? { ...current, settings: { ...current.settings, ...scales } } : current);

  useEffect(() => {
    if (incompleteIds.size === 0) setIncompleteOnly(false);
  }, [incompleteIds]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setBrandFilter("all");
    setIncompleteOnly(false);
  }, []);

  const addShoe = useCallback(() => {
    const shoe = createEmptyShoe();
    setData((current) => current ? { ...current, shoes: [...current.shoes, shoe] } : current);
    setActiveId(shoe.id);
    setExpandedId(shoe.id);
    clearFilters();
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-shoe-id="${shoe.id}"] [data-model-input]`)?.focus(), 50);
  }, [clearFilters]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (certificate) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault(); addShoe();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault(); void openPrintDialog();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addShoe, certificate, data, selectedIds, shoes, showToast]);

  const updateShoe = (id: string, next: ShoeLabel) => updateShoes(shoes.map((shoe) => shoe.id === id ? next : shoe));
  const duplicateShoe = (source: ShoeLabel) => {
    const now = new Date().toISOString();
    const copy: ShoeLabel = { ...structuredClone(source), id: crypto.randomUUID(), model: `${source.model} COPY`.trim(), createdAt: now, updatedAt: now };
    const index = shoes.findIndex((shoe) => shoe.id === source.id);
    const next = [...shoes]; next.splice(index + 1, 0, copy); updateShoes(next); setActiveId(copy.id); setExpandedId(copy.id);
  };
  const deleteShoe = (id: string) => {
    const shoe = shoes.find((item) => item.id === id);
    if (!shoe || !window.confirm(`Delete ${shoe.model || "this shoe label"}?`)) return;
    const next = shoes.filter((item) => item.id !== id);
    updateShoes(next.length ? next : [createEmptyShoe()]);
    setSelectedIds((current) => { const updated = new Set(current); updated.delete(id); return updated; });
    updateCart((cart) => removeFromCart(cart, id));
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
    const byId = new Map(updates.map((update) => [update.id, update]));
    const now = new Date().toISOString();
    updateShoes(shoes.map((shoe) => {
      const update = byId.get(shoe.id);
      return update ? { ...shoe, features: update.features, summary: update.summary, specs: update.specs, updatedAt: now } : shoe;
    }));
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

  /** A label must be complete before it goes on the print list; otherwise it is highlighted and nothing is added. */
  const blockIncomplete = (candidates: ShoeLabel[], action: string): boolean => {
    const invalid = candidates.find((shoe) => !validateShoe(shoe).valid);
    if (!invalid) return false;
    setActiveId(invalid.id);
    setExpandedId(invalid.id);
    if (!filteredShoes.some((shoe) => shoe.id === invalid.id)) clearFilters();
    showToast(`Complete ${invalid.model || "the highlighted label"} before ${action}.`, "error");
    return true;
  };

  const addShoeToCart = (shoe: ShoeLabel) => {
    if (blockIncomplete([shoe], "adding it to the print list")) return;
    updateCart((cart) => addToCart(cart, shoe.id, 1));
    showToast(`${shoe.model} added to the print list.`, "success");
  };

  /** Adds one copy of each ticked label that is ready; incomplete ones stay ticked for fixing. */
  const addSelectedToCart = () => {
    const incomplete = selectedShoes.filter((shoe) => incompleteIds.has(shoe.id));
    const fresh = selectedShoes.filter((shoe) => !incompleteIds.has(shoe.id) && !cartCopiesById.has(shoe.id));
    const already = selectedShoes.length - incomplete.length - fresh.length;
    updateCart((cart) => fresh.reduce((next, shoe) => addToCart(next, shoe.id, 1), cart));
    setSelectedIds(new Set(incomplete.map((shoe) => shoe.id)));
    const notes = [already && `${already} already on it`, incomplete.length && `${incomplete.length} need completing`].filter(Boolean).join(", ");
    showToast(`${fresh.length} label${fresh.length === 1 ? "" : "s"} added to the print list${notes ? ` (${notes})` : ""}.`, fresh.length ? "success" : "info");
  };

  function openPrintDialog() {
    if (!data) return;
    if (printQueue.length === 0) {
      showToast("The print list is empty. Click Add to print list on a label.", "info");
      return;
    }
    // Labels can be edited after they were added, so check again.
    if (blockIncomplete(printQueue, "printing")) return;
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
        paperSize: data.settings.paperSize,
        labelSize: data.settings.labelSize,
        modelTextScale: data.settings.modelTextScale,
        featureTextScale: data.settings.featureTextScale,
        priceTextScale: data.settings.priceTextScale,
        regularPriceTextScale: data.settings.regularPriceTextScale,
        saleSealScale: data.settings.saleSealScale,
        calibration: data.settings.calibration
      });
      if (result.success) {
        showToast(`${kind === "labels" ? "Labels" : "Calibration page"} opened in the PDF preview. Click the printer icon to print at 100% scale.`, "success");
        if (kind === "labels") {
          setPrintOpen(false);
          updateCart(() => []);
        }
      } else showToast(result.reason || "Could not create the PDF.", "error");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not create the PDF.", "error");
    } finally { setPrinting(false); }
  }

  async function printGiftCertificate() {
    if (!certificate || giftPrintPending.current) return;
    const error = certificateError(certificate);
    if (error) { showToast(error, "error"); return; }
    if (!window.electronAPI) { showToast("Printing is available in the desktop application.", "error"); return; }
    giftPrintPending.current = true;
    setPrinting(true);
    try {
      const result = await window.electronAPI.print({ kind: "gift-certificate", certificate });
      if (result.success) {
        setData((current) => current ? { ...current, settings: { ...current.settings, giftCertificateSigner: certificate.signer } } : current);
        setCertificate(null);
        showToast("Gift certificate opened in the PDF preview. Click the printer icon and use Letter paper at 100% scale.", "success");
      } else showToast(result.reason || "Could not create the PDF.", "error");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not create the PDF.", "error");
    } finally { giftPrintPending.current = false; setPrinting(false); }
  }

  if (!data) return <div className="app-loading"><div className="loading-mark" /><p>Loading label workspace…</p></div>;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand"><img src={appIconUrl} alt="Runners Life" /><div><strong>Label Creator</strong><span>SHOE WALL SYSTEM</span></div></div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => setCertificate(createGiftCertificate(data.settings.giftCertificateSigner))}><Gift size={17} /> Gift certificate</button>
          <UpdateButton status={updateStatus} onClick={openUpdates} />
          <span className={`save-state ${saveState}`}><Check size={14} />{saveState === "saving" ? "Saving…" : saveState === "error" ? "Save error" : "Saved locally"}</span>
        </div>
      </header>

      <section className="dashboard-strip">
        <div><Tags size={19} /><strong>{shoes.length}</strong><span>shoe models</span></div>
        <div><strong>{validCount}</strong><span>ready to print</span></div>
        <div><strong>{saleCount}</strong><span>sale labels</span></div>
      </section>

      <main className="workspace">
        <section className="editor-pane">
          <div className="list-toolbar">
            <div className="search-box"><Search size={17} /><input value={search} placeholder="Search model or brand" onChange={(event) => setSearch(event.target.value)} />{search && <button onClick={() => setSearch("")}><X size={15} /></button>}</div>
            <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value as BrandId | "all")}>
              <option value="all">All brands</option>{BRAND_IDS.map((brand) => <option key={brand} value={brand}>{brandNames[brand]}</option>)}
            </select>
            {(incompleteIds.size > 0 || incompleteOnly) && (
              <button className={`incomplete-filter ${incompleteOnly ? "is-on" : ""}`} aria-pressed={incompleteOnly} onClick={() => setIncompleteOnly((current) => !current)}>
                <TriangleAlert size={14} /> {incompleteIds.size} to complete
              </button>
            )}
            <span className="result-count">{filteredShoes.length} shown</span>
            <button className="primary-button add-button" onClick={addShoe}><Plus size={17} /> Add shoe</button>
          </div>

          <PreviewPanel shoe={activeShoe} labelSize={data.settings.labelSize} onLabelSizeChange={updateLabelSize} textScales={data.settings} onTextScalesChange={updateTextScales} />

          <SelectionBar
            shownCount={filteredShoes.length}
            selectedCount={selectedIds.size}
            selectedShownCount={filteredShoes.filter((shoe) => selectedIds.has(shoe.id)).length}
            onToggleShown={toggleAllVisible}
            onClear={() => setSelectedIds(new Set())}
            cartLabels={printQueue.length}
            cartCopies={cartCopyCount(printCart)}
            onAi={() => setAiOpen(true)}
            onAddSelected={addSelectedToCart}
            onOpenCart={() => void openPrintDialog()}
          />

          <div className="shoe-list">
            <div className="shoe-list-header" aria-hidden="true"><span /><span>Brand</span><span>Model</span><span>Price</span><span>Print list</span><span /></div>
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
                    expanded={expandedId === shoe.id}
                    onToggle={() => setExpandedId((current) => current === shoe.id ? null : shoe.id)}
                    selected={selectedIds.has(shoe.id)}
                    canMoveUp={globalIndex > 0}
                    canMoveDown={globalIndex < shoes.length - 1}
                    onActivate={() => setActiveId(shoe.id)}
                    onSelect={(selected) => setSelectedIds((current) => { const next = new Set(current); selected ? next.add(shoe.id) : next.delete(shoe.id); return next; })}
                    onChange={(next) => updateShoe(shoe.id, next)}
                    onDuplicate={() => duplicateShoe(shoe)}
                    onDelete={() => deleteShoe(shoe.id)}
                    onMove={(direction) => moveShoe(shoe.id, direction)}
                    cartCopies={cartCopiesById.get(shoe.id) ?? null}
                    onAddToCart={() => addShoeToCart(shoe)}
                    onCartCopiesChange={(copies) => updateCart((cart) => setCartCopies(cart, shoe.id, copies))}
                    onRemoveFromCart={() => updateCart((cart) => removeFromCart(cart, shoe.id))}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="app-footer"><span>Runners Life Label Creator v{appVersion}{updater.state && <> · <button className="link-button" onClick={openUpdates}>Check for updates</button></>}</span><span>Offline data · {formatLabelSize(data.settings.labelSize)} label · approved Scheme A system</span></footer>
      <PrintDialog
        open={printOpen}
        shoes={printQueue}
        settings={data.settings}
        printing={printing}
        onClose={() => { if (!printing) setPrintOpen(false); }}
        onCopiesChange={(id, copies) => updateCart((cart) => setCartCopies(cart, id, copies))}
        onRemove={(id) => updateCart((cart) => removeFromCart(cart, id))}
        onSettingsChange={updateSettings}
        onPrint={() => void runPrint("labels")}
        onCalibrationPrint={() => void runPrint("calibration")}
      />
      {certificate && <GiftCertificateDialog certificate={certificate} printing={printing} onChange={setCertificate} onClose={() => { if (!giftPrintPending.current) setCertificate(null); }} onPrint={() => void printGiftCertificate()} />}
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
