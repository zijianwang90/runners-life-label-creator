import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const EXTRACT_TIMEOUT_MS = 5 * 60 * 1000;

/** `tar` ships with Windows 10 (1803) and later and reads zip files, so no extra tool is needed. */
function tarPath(): string {
  return process.platform === "win32"
    ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe")
    : "tar";
}

export async function extractZip(zipFile: string, destination: string): Promise<void> {
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    execFile(tarPath(), ["-xf", zipFile, "-C", destination], { timeout: EXTRACT_TIMEOUT_MS, windowsHide: true }, (error, _stdout, stderr) => {
      if (error) reject(new Error(`Could not unpack the update: ${stderr.trim() || error.message}`));
      else resolve();
    });
  });
}

/**
 * The folder whose contents are the app. A zip made by hand usually wraps everything in one
 * folder (`Runners-Life-Label-Creator-Portable/…`); the release zip may not.
 */
export async function resolveExtractedRoot(directory: string): Promise<string> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries.length === 1 && entries[0].isDirectory() ? path.join(directory, entries[0].name) : directory;
}
