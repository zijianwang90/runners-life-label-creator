import { normalizeAppData } from "../data";
import type { AppData, DataBackup } from "../types";

export const DATA_BACKUP_FORMAT = "runners-life-label-creator-backup";

/** The date makes several exports from the same computer easy to tell apart. */
export function backupFileName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `Runners-Life-Label-Data-${stamp}.json`;
}

export function createDataBackup(data: AppData, appVersion: string, exportedAt = new Date()): DataBackup {
  return {
    format: DATA_BACKUP_FORMAT,
    backupVersion: 1,
    appVersion,
    exportedAt: exportedAt.toISOString(),
    data
  };
}

/**
 * Accepts a file made by Export data as well as the older raw `labels.json` kept in the app's
 * user-data folder. Everything goes through the same normalization as a normal start-up, so a
 * damaged or foreign file cannot put the workspace into an unusable state.
 */
export function readDataBackup(input: unknown): AppData {
  if (!input || typeof input !== "object") throw new Error("The selected file is not a Runners Life data file.");
  const record = input as Record<string, unknown>;
  if (record.format !== undefined && record.format !== DATA_BACKUP_FORMAT) {
    throw new Error("The selected file was not created by Runners Life Label Creator.");
  }
  const payload = record.format === DATA_BACKUP_FORMAT ? record.data : input;
  return normalizeAppData(payload);
}
