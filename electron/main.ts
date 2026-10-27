import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, type WebContentsPrintOptions } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SAVE_PDF_PRINTER, type AppData, type LabelSize, type PrintPayload, type PrintResult, type PrinterInfoLite } from "../src/types";
import { clampLabelSize } from "../src/utils/labelSize";
import { Updater } from "./updater";

const UPDATE_CHECK_DELAY_MS = 8_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let mainWindow: BrowserWindow | null = null;
let saveQueue: Promise<void> = Promise.resolve();
let quitAfterSaving = false;

const dataFilePath = () => path.join(app.getPath("userData"), "labels.json");
const APP_ID = "ca.runnerslife.labelcreator";

function appIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(app.getAppPath(), "build", "icon.png");
}

async function loadStoredData(): Promise<AppData | null> {
  try {
    const raw = await fs.readFile(dataFilePath(), "utf8");
    return JSON.parse(raw) as AppData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function saveStoredData(data: AppData): Promise<void> {
  await fs.mkdir(path.dirname(dataFilePath()), { recursive: true });
  const tempPath = `${dataFilePath()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  try {
    await fs.rename(tempPath, dataFilePath());
  } catch {
    await fs.copyFile(tempPath, dataFilePath());
    await fs.unlink(tempPath);
  }
}

function rendererPath(): string {
  return path.join(__dirname, "../../dist/index.html");
}

async function loadRenderer(window: BrowserWindow, hash = ""): Promise<void> {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await window.loadURL(`${devUrl}${hash ? `#${hash}` : ""}`);
  } else {
    await window.loadFile(rendererPath(), hash ? { hash } : undefined);
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#f4f2ef",
    icon: appIconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL
      ? url.startsWith(process.env.VITE_DEV_SERVER_URL)
      : url.startsWith("file://");
    if (!allowed) event.preventDefault();
  });
  void loadRenderer(mainWindow);
}

// The payload comes from the renderer; never trust it for the physical page size.
const payloadLabelSize = (payload: PrintPayload): LabelSize => clampLabelSize(payload.labelSize);

function printOptions(payload: PrintPayload): WebContentsPrintOptions {
  const base: WebContentsPrintOptions = {
    silent: !payload.useSystemDialog,
    printBackground: true,
    color: true,
    margins: { marginType: "none" },
    scaleFactor: 100,
    copies: 1,
    collate: true
  };
  if (payload.printerName) base.deviceName = payload.printerName;
  if (payload.mode === "custom") {
    const size = payloadLabelSize(payload);
    base.pageSize = { width: Math.round(size.widthMm * 1000), height: Math.round(size.heightMm * 1000) };
    base.landscape = false;
  } else {
    base.pageSize = "A4";
    base.landscape = true;
  }
  return base;
}

function pdfOptions(payload: PrintPayload): Electron.PrintToPDFOptions {
  const size = payloadLabelSize(payload);
  return {
    landscape: payload.mode === "a4",
    displayHeaderFooter: false,
    printBackground: true,
    scale: 1,
    margins: { marginType: "none" },
    pageSize: payload.mode === "custom"
      ? { width: size.widthMm / 25.4, height: size.heightMm / 25.4 }
      : "A4",
    preferCSSPageSize: true
  };
}

function pdfDefaultName(payload: PrintPayload): string {
  if (payload.kind === "calibration") return `runners-life-calibration-${payload.mode}.pdf`;
  const model = payload.labels.length === 1 ? payload.labels[0].model.trim() : "selected-labels";
  const safeModel = (model || "shoe-labels").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-").slice(0, 80);
  return `runners-life-${safeModel}.pdf`;
}

async function runPrint(payload: PrintPayload): Promise<PrintResult> {
  const printWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    icon: appIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise<PrintResult>(async (resolve) => {
    let settled = false;
    const finish = (result: PrintResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      ipcMain.removeListener("print:ready", onReady);
      if (!printWindow.isDestroyed()) printWindow.destroy();
      resolve(result);
    };

    const onReady = async (event: Electron.IpcMainEvent, readyJobId: string) => {
      if (readyJobId !== jobId || event.sender.id !== printWindow.webContents.id) return;
      if (payload.printerName === SAVE_PDF_PRINTER) {
        try {
          const saveResult = await dialog.showSaveDialog(mainWindow ?? printWindow, {
            title: payload.kind === "calibration" ? "Save calibration PDF" : "Save label PDF",
            defaultPath: pdfDefaultName(payload),
            filters: [{ name: "PDF document", extensions: ["pdf"] }]
          });
          if (saveResult.canceled || !saveResult.filePath) {
            finish({ success: false, reason: "PDF save cancelled." });
            return;
          }
          const pdf = await printWindow.webContents.printToPDF(pdfOptions(payload));
          await fs.writeFile(saveResult.filePath, pdf);
          finish({ success: true, outputPath: saveResult.filePath });
        } catch (error) {
          finish({ success: false, reason: error instanceof Error ? error.message : "Unable to save the PDF." });
        }
        return;
      }
      printWindow.webContents.print(printOptions(payload), (success, failureReason) => {
        finish(success ? { success: true } : { success: false, reason: failureReason });
      });
    };

    const timeout = setTimeout(() => finish({ success: false, reason: "Print preview timed out." }), 60000);
    ipcMain.on("print:ready", onReady);

    try {
      await loadRenderer(printWindow, "print");
      printWindow.webContents.send("print:payload", { jobId, payload });
    } catch (error) {
      finish({ success: false, reason: error instanceof Error ? error.message : "Unable to load print document." });
    }
  });
}

app.setAppUserModelId(APP_ID);

app.whenReady().then(() => {
  const icon = nativeImage.createFromPath(appIconPath());
  if (process.platform === "darwin" && !icon.isEmpty()) app.dock?.setIcon(icon);
  app.setAboutPanelOptions({
    applicationName: "Runners Life Label Creator",
    applicationVersion: app.getVersion(),
    copyright: "Runners Life",
    iconPath: appIconPath()
  });
  Menu.setApplicationMenu(null);
  createMainWindow();

  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("data:load", () => loadStoredData());
  ipcMain.handle("data:save", (_event, data: AppData) => {
    saveQueue = saveQueue.catch(() => undefined).then(() => saveStoredData(data));
    return saveQueue;
  });
  ipcMain.handle("printers:list", async (event): Promise<PrinterInfoLite[]> => {
    const printers = await event.sender.getPrintersAsync();
    return printers.map((printer) => {
      const options = printer.options as Record<string, unknown>;
      const rawDefault = options.isDefault ?? options["printer-is-default"];
      return {
        name: printer.name,
        displayName: printer.displayName || printer.name,
        description: printer.description || "",
        status: Number(options.status) || 0,
        isDefault: rawDefault === true || rawDefault === "true" || rawDefault === "1"
      };
    });
  });
  ipcMain.handle("print:run", (_event, payload: PrintPayload) => runPrint(payload));

  const updater = new Updater({
    onChange: (state) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update:state", state);
    },
    flushData: () => saveQueue.catch(() => undefined)
  });
  ipcMain.handle("update:state", () => updater.getState());
  ipcMain.handle("update:check", () => updater.check({ silent: false }));
  ipcMain.handle("update:install", () => updater.install());
  ipcMain.handle("update:open-release", () => updater.openReleasePage());

  // Quietly look for a new release a few seconds after start-up and every few hours after that
  // (shop computers are often left running for days). A dev run only checks when asked.
  void updater.cleanupLeftovers();
  if (app.isPackaged) {
    setTimeout(() => void updater.check({ silent: true }), UPDATE_CHECK_DELAY_MS);
    setInterval(() => void updater.check({ silent: true }), UPDATE_CHECK_INTERVAL_MS).unref();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (quitAfterSaving) return;
  event.preventDefault();
  void saveQueue.finally(() => {
    quitAfterSaving = true;
    app.quit();
  });
});
