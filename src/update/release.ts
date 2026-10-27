import type { UpdateChannel } from "../types";

/**
 * Pure helpers for the GitHub Releases updater: version comparison, parsing the
 * API reply, picking the right download and finding its checksum. Nothing here
 * touches the network or the file system, so it is all unit-tested.
 */

export interface GithubRepo { owner: string; repo: string }

export interface ReleaseAsset {
  name: string;
  size: number;
  url: string;
  /** `sha256:<hex>` as reported by the GitHub API, when it has one. */
  digest: string | null;
}

export interface ReleaseInfo {
  version: string;
  tag: string;
  notes: string;
  pageUrl: string;
  publishedAt: string;
  assets: ReleaseAsset[];
}

export const CHECKSUM_ASSET_NAME = "SHA256SUMS.txt";
const MAX_NOTES_LENGTH = 6000;

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

interface ParsedVersion { core: [number, number, number]; pre: string[] }

function parseVersion(text: string): ParsedVersion | null {
  const match = VERSION_PATTERN.exec(text.trim());
  if (!match) return null;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ? match[4].split(".") : [] };
}

/** Normalises `v1.2.3` to `1.2.3`; returns null when the text is not a semantic version. */
export function normalizeVersion(text: string): string | null {
  const parsed = parseVersion(text);
  if (!parsed) return null;
  const base = parsed.core.join(".");
  return parsed.pre.length ? `${base}-${parsed.pre.join(".")}` : base;
}

function comparePrerelease(a: string[], b: string[]): number {
  // A release outranks any of its own pre-releases.
  if (a.length === 0 || b.length === 0) return a.length === b.length ? 0 : a.length === 0 ? 1 : -1;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] === undefined) return -1;
    if (b[index] === undefined) return 1;
    const aNumeric = /^\d+$/.test(a[index]);
    const bNumeric = /^\d+$/.test(b[index]);
    if (aNumeric && bNumeric) {
      const diff = Number(a[index]) - Number(b[index]);
      if (diff !== 0) return Math.sign(diff);
    } else if (aNumeric !== bNumeric) {
      return aNumeric ? -1 : 1;
    } else if (a[index] !== b[index]) {
      return a[index] < b[index] ? -1 : 1;
    }
  }
  return 0;
}

/** Semantic-version order; returns NaN when either side is not a version. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return Number.NaN;
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] < right.core[index] ? -1 : 1;
  }
  return comparePrerelease(left.pre, right.pre);
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}

const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Downloads are only trusted when they come from this repository's own release files. */
export function isTrustedDownloadUrl(url: string, { owner, repo }: GithubRepo): boolean {
  return url.toLowerCase().startsWith(`https://github.com/${owner}/${repo}/releases/download/`.toLowerCase());
}

/** The release page the user is sent to; only this repository's own pages are allowed. */
export function isTrustedPageUrl(url: string, { owner, repo }: GithubRepo): boolean {
  return url.toLowerCase().startsWith(`https://github.com/${owner}/${repo}/`.toLowerCase());
}

export function releasesPageUrl({ owner, repo }: GithubRepo): string {
  return `https://github.com/${owner}/${repo}/releases/latest`;
}

const asText = (value: unknown): string => (typeof value === "string" ? value : "");

/** Reads the `GET /repos/{owner}/{repo}/releases/latest` reply. Throws when it is not a usable release. */
export function parseRelease(json: unknown, repo: GithubRepo): ReleaseInfo {
  if (!json || typeof json !== "object") throw new Error("GitHub sent an unexpected reply.");
  const raw = json as Record<string, unknown>;
  const tag = asText(raw.tag_name);
  const version = normalizeVersion(tag);
  if (!version) throw new Error(`The latest release tag "${tag}" is not a version number.`);

  const pageUrl = asText(raw.html_url);
  const assets: ReleaseAsset[] = (Array.isArray(raw.assets) ? raw.assets : []).flatMap((item): ReleaseAsset[] => {
    if (!item || typeof item !== "object") return [];
    const asset = item as Record<string, unknown>;
    const name = asText(asset.name);
    const url = asText(asset.browser_download_url);
    if (!name || !isTrustedDownloadUrl(url, repo)) return [];
    return [{
      name,
      url,
      size: typeof asset.size === "number" && Number.isFinite(asset.size) ? asset.size : 0,
      digest: /^sha256:[0-9a-f]{64}$/i.test(asText(asset.digest)) ? asText(asset.digest).toLowerCase() : null
    }];
  });

  return {
    version,
    tag,
    notes: asText(raw.body).replace(/\r\n/g, "\n").trim().slice(0, MAX_NOTES_LENGTH),
    pageUrl: isTrustedPageUrl(pageUrl, repo) ? pageUrl : releasesPageUrl(repo),
    publishedAt: asText(raw.published_at),
    assets
  };
}

const ASSET_PATTERNS: Record<Exclude<UpdateChannel, "manual">, RegExp> = {
  portable: /portable.*\.exe$/i,
  folder: /portable.*\.zip$/i,
  installer: /setup.*\.exe$/i
};

/** The file this computer should download for its channel and CPU, or null when the release has none. */
export function pickAsset(assets: ReleaseAsset[], channel: UpdateChannel, arch: string): ReleaseAsset | null {
  if (channel === "manual") return null;
  const otherArch = arch === "arm64" ? /x64|x86_64|amd64/i : /arm64|aarch64/i;
  const candidates = assets.filter((asset) => ASSET_PATTERNS[channel].test(asset.name) && !otherArch.test(asset.name));
  const own = candidates.find((asset) => asset.name.toLowerCase().includes(arch.toLowerCase()));
  return own ?? candidates[0] ?? null;
}

/** Parses `sha256sum` output: `<64 hex>  <file>` (a `*` before the name marks binary mode). */
export function parseChecksums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(line.trim());
    if (match) sums.set(match[2], match[1].toLowerCase());
  }
  return sums;
}

/** The expected SHA-256 for an asset: the API's own digest first, then the release's SHA256SUMS.txt. */
export function expectedChecksum(asset: ReleaseAsset, sumsText: string | null): string | null {
  if (asset.digest) return asset.digest.slice("sha256:".length);
  if (!sumsText) return null;
  for (const [name, hash] of parseChecksums(sumsText)) {
    if (sameText(name, asset.name)) return hash;
  }
  return null;
}

export interface ChannelProbe {
  platform: string;
  isPackaged: boolean;
  /** Set by electron-builder's portable launcher to the path of the portable exe. */
  portableFile: string | undefined;
  /** True when an NSIS uninstaller sits next to the running exe, i.e. it was installed with Setup. */
  hasUninstaller: boolean;
}

export function detectUpdateChannel({ platform, isPackaged, portableFile, hasUninstaller }: ChannelProbe): UpdateChannel {
  if (platform !== "win32" || !isPackaged) return "manual";
  if (portableFile) return "portable";
  // Neither the single-file launcher nor Setup: an unpacked app folder, which is what the portable zip extracts to.
  return hasUninstaller ? "installer" : "folder";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 100 ? `${Math.round(megabytes)} MB` : `${megabytes.toFixed(1)} MB`;
}
