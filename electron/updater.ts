import { app, net, shell } from "electron";
import { spawn } from "node:child_process";
import { promises as fs, readdirSync } from "node:fs";
import path from "node:path";
import type { UpdateChannel, UpdateInfo, UpdateState, UpdateStatus } from "../src/types";
import {
  CHECKSUM_ASSET_NAME,
  detectUpdateChannel,
  expectedChecksum,
  isNewerVersion,
  isTrustedPageUrl,
  parseRelease,
  pickAsset,
  releasesPageUrl,
  type GithubRepo,
  type ReleaseAsset,
  type ReleaseInfo
} from "../src/update/release";
import { downloadVerified, IntegrityError, type FetchLike } from "./download";

/** Releases are read from (and downloaded from) this public GitHub repository. */
export const UPDATE_REPO: GithubRepo = { owner: "zijianwang90", repo: "runners-life-label-creator" };

const API_TIMEOUT_MS = 15_000;
const CHECKSUM_FILE_LIMIT = 256 * 1024;

/**
 * Swaps the portable exe for the downloaded one. The old copy is still running (or still being
 * torn down) when this starts, so the move is retried until Windows lets go of the file.
 * Paths come through the environment, which keeps this script plain ASCII for any user name.
 */
const PORTABLE_APPLY_SCRIPT = [
  "@echo off",
  "set /a tries=0",
  ":retry",
  'move /Y "%RL_UPDATE_SOURCE%" "%RL_UPDATE_TARGET%" >nul 2>&1',
  "if not errorlevel 1 goto launch",
  "set /a tries+=1",
  "if %tries% GEQ 120 exit /b 1",
  "ping -n 2 127.0.0.1 >nul",
  "goto retry",
  ":launch",
  'start "" "%RL_UPDATE_TARGET%"',
  "exit /b 0",
  ""
].join("\r\n");

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`GitHub answered HTTP ${status}.`);
  }
}

interface UpdaterHooks {
  onChange: (state: UpdateState) => void;
  /** Resolves once everything the user typed has been written to disk. */
  flushData: () => Promise<void>;
}

const updateDir = () => path.join(app.getPath("temp"), "runners-life-label-creator-update");

function hasUninstaller(): boolean {
  try {
    return readdirSync(path.dirname(process.execPath)).some((name) => /^Uninstall .+\.exe$/i.test(name));
  } catch {
    return false;
  }
}

function describeError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 404) return "No published release was found on GitHub.";
    if (error.status === 403 || error.status === 429) return "GitHub is limiting requests from this network. Try again in a few minutes.";
    return error.message;
  }
  if (error instanceof IntegrityError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  if (/net::ERR_|fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET|abort/i.test(message)) {
    return "Could not reach GitHub. Check the internet connection and try again.";
  }
  return message;
}

function launchDetached(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true, env });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export class Updater {
  readonly channel: UpdateChannel = detectUpdateChannel({
    platform: process.platform,
    isPackaged: app.isPackaged,
    portableFile: process.env.PORTABLE_EXECUTABLE_FILE,
    hasUninstaller: hasUninstaller()
  });

  private status: UpdateStatus = { state: "idle" };
  private release: ReleaseInfo | null = null;
  private asset: ReleaseAsset | null = null;
  private busy = false;

  constructor(private readonly hooks: UpdaterHooks) {}

  getState(): UpdateState {
    return { channel: this.channel, currentVersion: app.getVersion(), status: this.status };
  }

  private setStatus(status: UpdateStatus): void {
    this.status = status;
    this.hooks.onChange(this.getState());
  }

  private fetchFn: FetchLike = (url, init) => net.fetch(url, {
    ...init,
    headers: { "User-Agent": `RunnersLifeLabelCreator/${app.getVersion()}`, ...init?.headers }
  });

  private async fetchApi(url: string): Promise<Response> {
    const response = await this.fetchFn(url, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
    });
    if (!response.ok) throw new HttpError(response.status);
    return response;
  }

  /** Looks for a newer release. A silent (background) check never shows an error. */
  async check({ silent }: { silent: boolean }): Promise<UpdateState> {
    if (this.busy) return this.getState();
    this.busy = true;
    if (!silent) this.setStatus({ state: "checking" });
    try {
      const { owner, repo } = UPDATE_REPO;
      const reply = await this.fetchApi(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
      const release = parseRelease(await reply.json(), UPDATE_REPO);
      if (isNewerVersion(release.version, app.getVersion())) {
        this.release = release;
        this.asset = pickAsset(release.assets, this.channel, process.arch);
        this.setStatus({ state: "available", update: this.infoFor(release) });
      } else {
        this.release = null;
        this.asset = null;
        this.setStatus({ state: "up-to-date", checkedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.warn("Update check failed:", error);
      if (!silent) this.setStatus({ state: "error", message: describeError(error) });
    } finally {
      this.busy = false;
    }
    return this.getState();
  }

  private infoFor(release: ReleaseInfo): UpdateInfo {
    return {
      version: release.version,
      notes: release.notes,
      pageUrl: release.pageUrl,
      publishedAt: release.publishedAt,
      sizeBytes: this.asset?.size || null
    };
  }

  async openReleasePage(): Promise<void> {
    const url = this.release?.pageUrl;
    await shell.openExternal(url && isTrustedPageUrl(url, UPDATE_REPO) ? url : releasesPageUrl(UPDATE_REPO));
  }

  /** Downloads and verifies the update, hands over to the installer or the swap script, then quits. */
  async install(): Promise<void> {
    const release = this.release;
    if (this.busy || !release) return;
    if (this.channel === "manual") return this.openReleasePage();

    this.busy = true;
    const update = this.infoFor(release);
    try {
      const asset = this.asset;
      if (!asset) throw new Error("This release has no download for this computer. Use “Open release page” to get it by hand.");

      const sha256 = expectedChecksum(asset, asset.digest ? null : await this.fetchChecksumFile(release));
      if (!sha256) throw new Error("This release has no checksum for the download, so it was not installed.");

      const directory = updateDir();
      await fs.rm(directory, { recursive: true, force: true });
      const file = path.join(directory, path.basename(asset.name));
      let lastBroadcast = 0;
      this.setStatus({ state: "downloading", update, receivedBytes: 0, totalBytes: asset.size });
      await downloadVerified({
        url: asset.url,
        destination: file,
        expectedSha256: sha256,
        expectedSize: asset.size,
        fetchFn: this.fetchFn,
        onProgress: (receivedBytes, totalBytes) => {
          const now = Date.now();
          if (now - lastBroadcast < 150 && receivedBytes < totalBytes) return;
          lastBroadcast = now;
          this.setStatus({ state: "downloading", update, receivedBytes, totalBytes });
        }
      });

      this.setStatus({ state: "installing", update });
      await this.hooks.flushData();
      if (this.channel === "portable") await this.applyPortable(file, directory);
      else await launchDetached(file, ["--updated", "/S", "--force-run"]);
      app.quit();
    } catch (error) {
      console.warn("Update failed:", error);
      this.setStatus({ state: "error", message: describeError(error), update });
      this.busy = false;
    }
  }

  private async fetchChecksumFile(release: ReleaseInfo): Promise<string | null> {
    const sums = release.assets.find((asset) => asset.name === CHECKSUM_ASSET_NAME);
    if (!sums || sums.size > CHECKSUM_FILE_LIMIT) return null;
    const response = await this.fetchFn(sums.url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    return response.ok ? response.text() : null;
  }

  private async applyPortable(downloaded: string, directory: string): Promise<void> {
    const target = process.env.PORTABLE_EXECUTABLE_FILE;
    if (!target) throw new Error("Could not find the portable app file to replace.");

    // Staged next to the old exe, so the final step is a same-volume rename and a failure shows up now, not after quitting.
    const staged = `${target}.update`;
    try {
      await fs.copyFile(downloaded, staged);
    } catch {
      throw new Error(`The app cannot write to its own folder (${path.dirname(target)}). Move it to a folder you can write to, or download the new version by hand.`);
    }

    const script = path.join(directory, "apply-update.cmd");
    await fs.writeFile(script, PORTABLE_APPLY_SCRIPT, "ascii");
    await launchDetached(process.env.ComSpec || "cmd.exe", ["/d", "/c", script], {
      ...process.env,
      RL_UPDATE_SOURCE: staged,
      RL_UPDATE_TARGET: target
    });
  }

  /** Removes what an earlier update left behind (downloads, the swap script, a staged exe). */
  async cleanupLeftovers(): Promise<void> {
    await fs.rm(updateDir(), { recursive: true, force: true }).catch(() => undefined);
    const portable = process.env.PORTABLE_EXECUTABLE_FILE;
    if (portable) await fs.rm(`${portable}.update`, { force: true }).catch(() => undefined);
  }
}
