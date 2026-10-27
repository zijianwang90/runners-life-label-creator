import { createHash } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<Response>;

export interface DownloadOptions {
  url: string;
  destination: string;
  /** Lower-case hex SHA-256 the finished file must have. */
  expectedSha256: string;
  /** Size the release says the file has; 0 when unknown. */
  expectedSize: number;
  fetchFn: FetchLike;
  onProgress: (receivedBytes: number, totalBytes: number) => void;
  /** Give up when no data arrives for this long. */
  stallMs?: number;
}

/** The file arrived but is not the file the release published. */
export class IntegrityError extends Error {}

/**
 * Downloads `url` to `destination`, hashing it on the way. The file only appears under its final
 * name once its size and SHA-256 match; a failed or interrupted download leaves nothing behind.
 */
export async function downloadVerified(options: DownloadOptions): Promise<void> {
  const { url, destination, expectedSha256, expectedSize, fetchFn, onProgress, stallMs = 30_000 } = options;
  const partPath = `${destination}.part`;
  const controller = new AbortController();
  let stallTimer: NodeJS.Timeout | undefined;
  const armStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(new Error("The download stalled.")), stallMs);
  };

  try {
    armStallTimer();
    const response = await fetchFn(url, { signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`The download failed (HTTP ${response.status}).`);
    const total = Number(response.headers.get("content-length")) || expectedSize;

    const hash = createHash("sha256");
    let received = 0;
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await pipeline(
      Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>),
      async function* (source: AsyncIterable<Buffer>) {
        for await (const chunk of source) {
          armStallTimer();
          hash.update(chunk);
          received += chunk.length;
          onProgress(received, total);
          yield chunk;
        }
      },
      createWriteStream(partPath),
      { signal: controller.signal }
    );

    if (expectedSize > 0 && received !== expectedSize) {
      throw new IntegrityError(`The download is incomplete (${received} of ${expectedSize} bytes).`);
    }
    if (hash.digest("hex") !== expectedSha256.toLowerCase()) {
      throw new IntegrityError("The downloaded file does not match the published checksum, so it was discarded.");
    }
    await fs.rename(partPath, destination);
  } catch (error) {
    await fs.rm(partPath, { force: true }).catch(() => undefined);
    // An abort from the stall timer carries its own message; surface that instead of "This operation was aborted".
    if (controller.signal.aborted && controller.signal.reason instanceof Error) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(stallTimer);
  }
}
