import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PutObjectInput, StorageAdapter, StoredObject } from "./types.js";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

/**
 * Writes files under <baseDir> and serves them via <publicBaseUrl>, which the
 * API exposes with express.static (see app.ts). Keys are relative POSIX paths
 * like "products/ab/abcd1234.jpg".
 */
export class LocalDiskStorage implements StorageAdapter {
  readonly name = "local";

  constructor(
    private readonly baseDir: string,
    private readonly publicBaseUrl: string,
  ) {}

  async put(input: PutObjectInput): Promise<StoredObject> {
    const ext = EXT_BY_TYPE[input.contentType] ?? (path.extname(input.filename) || ".bin");
    const id = crypto.randomBytes(16).toString("hex");
    const key = path.posix.join(input.prefix, id.slice(0, 2), `${id}${ext}`);
    const abs = path.join(this.baseDir, key);

    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, input.buffer);

    return { key, url: `${this.publicBaseUrl.replace(/\/$/, "")}/${key}` };
  }

  async delete(key: string): Promise<void> {
    if (!key) return;
    const abs = path.join(this.baseDir, key);
    // Guard against path traversal in a stored key.
    if (!abs.startsWith(path.resolve(this.baseDir))) return;
    await fs.rm(abs, { force: true });
  }

  get directory(): string {
    return this.baseDir;
  }
}
