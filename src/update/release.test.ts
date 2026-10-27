import { describe, expect, it } from "vitest";
import {
  compareVersions,
  detectUpdateChannel,
  expectedChecksum,
  formatBytes,
  isNewerVersion,
  isTrustedDownloadUrl,
  normalizeVersion,
  parseChecksums,
  parseRelease,
  pickAsset,
  type GithubRepo,
  type ReleaseAsset
} from "./release";

const repo: GithubRepo = { owner: "zijianwang90", repo: "runners-life-label-creator" };
const download = (name: string) => `https://github.com/${repo.owner}/${repo.repo}/releases/download/v1.2.0/${name}`;
const hash = (digit: string) => digit.repeat(64);

const asset = (name: string, overrides: Partial<ReleaseAsset> = {}): ReleaseAsset => ({ name, url: download(name), size: 100, digest: null, ...overrides });

describe("version comparison", () => {
  it("orders by major, minor and patch numerically", () => {
    expect(compareVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("2.0.0", "10.0.0")).toBe(-1);
    expect(compareVersions("1.2.3", "v1.2.3")).toBe(0);
  });

  it("ranks a release above its own pre-releases", () => {
    expect(isNewerVersion("1.2.0", "1.2.0-beta.1")).toBe(true);
    expect(isNewerVersion("1.2.0-beta.2", "1.2.0-beta.10")).toBe(false);
    expect(isNewerVersion("1.2.0-rc.1", "1.2.0-beta.9")).toBe(true);
  });

  it("is never newer when either side is not a version", () => {
    expect(isNewerVersion("latest", "1.0.0")).toBe(false);
    expect(isNewerVersion("1.0.1", "dev")).toBe(false);
  });

  it("normalises a leading v", () => {
    expect(normalizeVersion("v1.4.0")).toBe("1.4.0");
    expect(normalizeVersion("1.4")).toBeNull();
  });
});

describe("parseRelease", () => {
  const payload = {
    tag_name: "v1.2.0",
    body: "Fixes\r\n- printing",
    html_url: `https://github.com/${repo.owner}/${repo.repo}/releases/tag/v1.2.0`,
    published_at: "2026-10-30T12:00:00Z",
    assets: [
      { name: "Runners-Life-Label-Creator-Portable-x64.exe", size: 5, browser_download_url: download("Runners-Life-Label-Creator-Portable-x64.exe"), digest: `sha256:${hash("a")}` },
      { name: "evil.exe", size: 5, browser_download_url: "https://example.com/evil.exe" },
      { name: "notes.txt", size: 1, browser_download_url: download("notes.txt"), digest: "md5:123" }
    ]
  };

  it("reads the version, notes and trusted assets", () => {
    const release = parseRelease(payload, repo);
    expect(release.version).toBe("1.2.0");
    expect(release.notes).toBe("Fixes\n- printing");
    expect(release.assets.map((item) => item.name)).toEqual(["Runners-Life-Label-Creator-Portable-x64.exe", "notes.txt"]);
    expect(release.assets[0].digest).toBe(`sha256:${hash("a")}`);
    expect(release.assets[1].digest).toBeNull();
  });

  it("drops downloads that are not this repository's own release files", () => {
    expect(isTrustedDownloadUrl("https://github.com/someone-else/runners-life-label-creator/releases/download/v1/a.exe", repo)).toBe(false);
    expect(isTrustedDownloadUrl("http://github.com/zijianwang90/runners-life-label-creator/releases/download/v1/a.exe", repo)).toBe(false);
    expect(isTrustedDownloadUrl(download("a.exe").toUpperCase(), repo)).toBe(true);
  });

  it("falls back to the repository's release page for an untrusted page link", () => {
    expect(parseRelease({ ...payload, html_url: "https://example.com/phish" }, repo).pageUrl)
      .toBe(`https://github.com/${repo.owner}/${repo.repo}/releases/latest`);
  });

  it("rejects replies that are not a versioned release", () => {
    expect(() => parseRelease(null, repo)).toThrow();
    expect(() => parseRelease({ tag_name: "nightly" }, repo)).toThrow(/not a version/);
  });
});

describe("pickAsset", () => {
  const assets = [
    asset("Runners-Life-Label-Creator-Setup-1.2.0-x64.exe"),
    asset("Runners-Life-Label-Creator-Setup-1.2.0-arm64.exe"),
    asset("Runners-Life-Label-Creator-Portable-x64.exe"),
    asset("Runners-Life-Label-Creator-Portable-x64.exe.blockmap"),
    asset("Runners-Life-Label-Creator-1.2.0-universal.dmg")
  ];

  it("picks the portable exe for a portable copy", () => {
    expect(pickAsset(assets, "portable", "x64")?.name).toBe("Runners-Life-Label-Creator-Portable-x64.exe");
  });

  it("picks the installer that matches the CPU", () => {
    expect(pickAsset(assets, "installer", "x64")?.name).toContain("x64");
    expect(pickAsset(assets, "installer", "arm64")?.name).toContain("arm64");
  });

  it("never offers a build for the other CPU", () => {
    expect(pickAsset([asset("Setup-1.2.0-arm64.exe")], "installer", "x64")).toBeNull();
  });

  it("offers nothing to copies that cannot update themselves", () => {
    expect(pickAsset(assets, "manual", "x64")).toBeNull();
    expect(pickAsset([], "portable", "x64")).toBeNull();
  });
});

describe("checksums", () => {
  const sums = [`${hash("b")}  Runners-Life-Label-Creator-Portable-x64.exe`, `${hash("c").toUpperCase()} *other file.dmg`, "garbage"].join("\n");

  it("parses sha256sum output in text and binary mode", () => {
    const parsed = parseChecksums(sums);
    expect(parsed.get("Runners-Life-Label-Creator-Portable-x64.exe")).toBe(hash("b"));
    expect(parsed.get("other file.dmg")).toBe(hash("c"));
    expect(parsed.size).toBe(2);
  });

  it("prefers the API digest and falls back to SHA256SUMS.txt", () => {
    expect(expectedChecksum(asset("a.exe", { digest: `sha256:${hash("d")}` }), sums)).toBe(hash("d"));
    expect(expectedChecksum(asset("Runners-Life-Label-Creator-Portable-x64.exe"), sums)).toBe(hash("b"));
    expect(expectedChecksum(asset("Runners-Life-Label-Creator-Portable-x64.exe"), null)).toBeNull();
    expect(expectedChecksum(asset("unlisted.exe"), sums)).toBeNull();
  });
});

describe("detectUpdateChannel", () => {
  const base = { platform: "win32", isPackaged: true, portableFile: undefined, hasUninstaller: false };

  it("recognises the portable launcher and the installed app", () => {
    expect(detectUpdateChannel({ ...base, portableFile: "D:\\Shop\\Label.exe" })).toBe("portable");
    expect(detectUpdateChannel({ ...base, hasUninstaller: true })).toBe("installer");
  });

  it("does not self-update an unpacked folder, a dev run or another platform", () => {
    expect(detectUpdateChannel(base)).toBe("manual");
    expect(detectUpdateChannel({ ...base, isPackaged: false, hasUninstaller: true })).toBe("manual");
    expect(detectUpdateChannel({ ...base, platform: "darwin", hasUninstaller: true })).toBe("manual");
  });
});

describe("formatBytes", () => {
  it("shows megabytes", () => {
    expect(formatBytes(97_000_000)).toBe("92.5 MB");
    expect(formatBytes(213_000_000)).toBe("203 MB");
    expect(formatBytes(0)).toBe("0 MB");
  });
});
