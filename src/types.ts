export const BRAND_IDS = ["new-balance", "saucony", "asics", "brooks"] as const;

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
  labelSize: LabelSize;
  /** Size of the three selling points relative to the approved design (1 = approved). */
  featureTextScale: number;
  calibration: CalibrationSettings;
}

export interface AppData {
  version: 1;
  shoes: ShoeLabel[];
  settings: AppSettings;
}

export interface PrintPayload {
  jobId?: string;
  kind: "labels" | "calibration";
  labels: ShoeLabel[];
  mode: PrintMode;
  currencySymbol: string;
  labelSize: LabelSize;
  featureTextScale: number;
  calibration: CalibrationSettings;
}

export interface PrintResult {
  success: boolean;
  reason?: string;
  /** The PDF that was written and opened in the system's default PDF viewer. */
  outputPath?: string;
}

/**
 * How this copy of the app can bring itself up to date:
 * - `portable`: the single-file Windows portable exe replaces itself and restarts.
 * - `folder`: an unzipped Windows portable folder; the new files are copied over it and the app restarts.
 * - `installer`: the Windows installer (NSIS) is downloaded and run silently.
 * - `manual`: anything else (macOS, a dev run); the app only points to the release page.
 */
export type UpdateChannel = "portable" | "folder" | "installer" | "manual";

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
  /** Renders the labels to a PDF and opens it in the system's default PDF viewer; printing is done from there. */
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
