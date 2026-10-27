import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppData, LabelSize, PrintPayload, PrintResult } from "../src/types";
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

// The PDFs the app opens for printing live in the system temp folder; old ones are swept away on the next print.
const pdfFolder = () => path.join(app.getPath("temp"), "runners-life-label-creator");
const PDF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function pdfFileName(payload: PrintPayload): string {
  // The timestamp keeps every file unique, so one a PDF viewer still has open is never overwritten.
  const stamp = new Date().toISOString().replace(/\..*$/, "").replace(/[-:]/g, "").replace("T", "-");
  if (payload.kind === "calibration") return `runners-life-calibration-${payload.mode}-${stamp}.pdf`;
  const model = payload.labels.length === 1 ? payload.labels[0].model.trim() : "selected-labels";
  const safeModel = (model || "shoe-labels").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-").slice(0, 80);
  return `runners-life-${safeModel}-${stamp}.pdf`;
}

async function removeOldPdfs(): Promise<void> {
  try {
    const folder = pdfFolder();
    for (const name of await fs.readdir(folder)) {
      if (!name.toLowerCase().endsWith(".pdf")) continue;
      const file = path.join(folder, name);
      const { mtimeMs } = await fs.stat(file);
      if (Date.now() - mtimeMs > PDF_MAX_AGE_MS) await fs.unlink(file);
    }
  } catch {
    // Clean-up is best effort; a locked or missing file must never get in the way of printing.
  }
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
      try {
        const pdf = await printWindow.webContents.printToPDF(pdfOptions(payload));
        await removeOldPdfs();
        await fs.mkdir(pdfFolder(), { recursive: true });
        const filePath = path.join(pdfFolder(), pdfFileName(payload));
        await fs.writeFile(filePath, pdf);
        // openPath resolves to an error message, or an empty string once the default PDF viewer has been launched.
        const openError = await shell.openPath(filePath);
        if (openError) {
          shell.showItemInFolder(filePath);
          finish({ success: false, reason: `The PDF was created but could not be opened (${openError}). It is in ${pdfFolder()}.` });
          return;
        }
        finish({ success: true, outputPath: filePath });
      } catch (error) {
        finish({ success: false, reason: error instanceof Error ? error.message : "Unable to create the PDF." });
      }
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
