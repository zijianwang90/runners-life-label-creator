export const BRAND_IDS = ["new-balance", "saucony", "asics", "brooks"] as const;
export const SAVE_PDF_PRINTER = "__save_pdf__";

export type BrandId = (typeof BRAND_IDS)[number];
export type PrintMode = "custom" | "a4";
export type PriceState = "regular" | "sale";

export interface ShoeLabel {
  id: string;
  brand: BrandId;
  model: string;
  regularPrice: number | null;
  salePrice: number | null;
  features: [string, string, string];
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CalibrationSettings {
  scaleX: number;
  scaleY: number;
  offsetXmm: number;
  offsetYmm: number;
}

/** Physical size of one printed label, in millimetres. */
export interface LabelSize {
  widthMm: number;
  heightMm: number;
}

export interface AppSettings {
  currencySymbol: string;
  printMode: PrintMode;
  printerName: string;
  useSystemDialog: boolean;
  labelSize: LabelSize;
  calibration: CalibrationSettings;
}

export interface AppData {
  version: 1;
  shoes: ShoeLabel[];
  settings: AppSettings;
}

export interface PrinterInfoLite {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

export interface PrintPayload {
  jobId?: string;
  kind: "labels" | "calibration";
  labels: ShoeLabel[];
  mode: PrintMode;
  printerName: string;
  useSystemDialog: boolean;
  currencySymbol: string;
  labelSize: LabelSize;
  calibration: CalibrationSettings;
}

export interface PrintResult {
  success: boolean;
  reason?: string;
  outputPath?: string;
}

/**
 * How this copy of the app can bring itself up to date:
 * - `portable`: the Windows portable exe replaces itself and restarts.
 * - `installer`: the Windows installer (NSIS) is downloaded and run silently.
 * - `manual`: anything else (macOS, a dev run, an unpacked folder); the app only points to the release page.
 */
export type UpdateChannel = "portable" | "installer" | "manual";

/** A newer release found on GitHub. */
export interface UpdateInfo {
  version: string;
  notes: string;
  pageUrl: string;
  publishedAt: string;
  /** Size of the file this computer would download, when the release has one. */
  sizeBytes: number | null;
}

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "up-to-date"; checkedAt: string }
  | { state: "available"; update: UpdateInfo }
  | { state: "downloading"; update: UpdateInfo; receivedBytes: number; totalBytes: number }
  | { state: "installing"; update: UpdateInfo }
  | { state: "error"; message: string; update?: UpdateInfo };

export interface UpdateState {
  channel: UpdateChannel;
  currentVersion: string;
  status: UpdateStatus;
}

export interface ElectronAPI {
  loadData: () => Promise<AppData | null>;
  saveData: (data: AppData) => Promise<void>;
  listPrinters: () => Promise<PrinterInfoLite[]>;
  print: (payload: PrintPayload) => Promise<PrintResult>;
  onPrintPayload: (callback: (jobId: string, payload: PrintPayload) => void) => () => void;
  notifyPrintReady: (jobId: string) => void;
  getAppVersion: () => Promise<string>;
  getUpdateState: () => Promise<UpdateState>;
  checkForUpdates: () => Promise<UpdateState>;
  /** Downloads, verifies and installs the update, then restarts. Progress arrives through `onUpdateState`. */
  installUpdate: () => Promise<void>;
  openReleasePage: () => Promise<void>;
  onUpdateState: (callback: (state: UpdateState) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
