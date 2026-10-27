// @vitest-environment node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { downloadVerified, IntegrityError, type FetchLike } from "./download";

const body = Buffer.from("Runners Life label creator update ".repeat(5000));
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

let dir: string;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), "rl-download-")); });
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

function serve(data: Buffer, init: ResponseInit = {}): FetchLike {
  return async () => new Response(data, { status: 200, headers: { "content-length": String(data.length) }, ...init });
}

const run = (fetchFn: FetchLike, overrides: Partial<Parameters<typeof downloadVerified>[0]> = {}) => {
  const progress: number[] = [];
  const destination = path.join(dir, "sub", "update.exe");
  const promise = downloadVerified({
    url: "https://github.com/x/y/releases/download/v1/update.exe",
    destination,
    expectedSha256: sha256(body),
    expectedSize: body.length,
    fetchFn,
    onProgress: (received) => progress.push(received),
    ...overrides
  });
  return { promise, progress, destination };
};

describe("downloadVerified", () => {
  it("saves a file that matches its checksum and reports progress", async () => {
    const { promise, progress, destination } = run(serve(body));
    await promise;
    expect(await fs.readFile(destination)).toEqual(body);
    expect(progress.at(-1)).toBe(body.length);
    await expect(fs.stat(`${destination}.part`)).rejects.toThrow();
  });

  it("accepts an upper-case checksum", async () => {
    const { promise } = run(serve(body), { expectedSha256: sha256(body).toUpperCase() });
    await expect(promise).resolves.toBeUndefined();
  });

  it("discards a file whose checksum differs", async () => {
    const tampered = Buffer.from(body);
    tampered[10] ^= 0xff;
    const { promise, destination } = run(serve(tampered));
    await expect(promise).rejects.toBeInstanceOf(IntegrityError);
    await expect(fs.stat(destination)).rejects.toThrow();
    await expect(fs.stat(`${destination}.part`)).rejects.toThrow();
  });

  it("discards a truncated file", async () => {
    const { promise, destination } = run(serve(body.subarray(0, 1000)));
    await expect(promise).rejects.toThrow(/incomplete/);
    await expect(fs.stat(destination)).rejects.toThrow();
  });

  it("reports an HTTP error", async () => {
    const { promise } = run(async () => new Response("nope", { status: 404 }));
    await expect(promise).rejects.toThrow(/HTTP 404/);
  });

  it("gives up when the server stops sending data", async () => {
    const stalled: FetchLike = async (_url, init) => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(body.subarray(0, 100));
        init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
      }
    }), { status: 200 });
    const { promise, destination } = run(stalled, { stallMs: 50 });
    await expect(promise).rejects.toThrow(/stalled/);
    await expect(fs.stat(`${destination}.part`)).rejects.toThrow();
  });
});
