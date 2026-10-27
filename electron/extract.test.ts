// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveExtractedRoot } from "./extract";

let dir: string;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), "rl-extract-")); });
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

describe("resolveExtractedRoot", () => {
  it("steps into the single folder a hand-made zip wraps everything in", async () => {
    await fs.mkdir(path.join(dir, "Runners-Life-Label-Creator-Portable", "locales"), { recursive: true });
    expect(await resolveExtractedRoot(dir)).toBe(path.join(dir, "Runners-Life-Label-Creator-Portable"));
  });

  it("keeps the folder itself when the app files sit at the top", async () => {
    await fs.writeFile(path.join(dir, "app.exe"), "x");
    await fs.mkdir(path.join(dir, "locales"));
    expect(await resolveExtractedRoot(dir)).toBe(dir);
  });

  it("does not step into a lone file", async () => {
    await fs.writeFile(path.join(dir, "app.exe"), "x");
    expect(await resolveExtractedRoot(dir)).toBe(dir);
  });
});
