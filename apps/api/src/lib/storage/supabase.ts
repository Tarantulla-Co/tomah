import crypto from "node:crypto";
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
 * Stores uploaded assets in a Supabase Storage bucket via its REST API — no SDK,
 * so nothing WebSocket/realtime-related is pulled into the serverless bundle.
 *
 * The bucket must be **public** (read) so the returned URLs resolve without a
 * signed token. Writes use the service-role key and bypass RLS.
 *
 * Keys mirror the local adapter: "<prefix>/<xx>/<hex>.<ext>".
 */
export class SupabaseStorage implements StorageAdapter {
  readonly name = "supabase";
  private readonly base: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string,
    private readonly bucket: string,
  ) {
    this.base = supabaseUrl.replace(/\/$/, "");
  }

  private encodeKey(key: string): string {
    return key.split("/").map(encodeURIComponent).join("/");
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const ext = EXT_BY_TYPE[input.contentType] ?? (path.extname(input.filename) || ".bin");
    const id = crypto.randomBytes(16).toString("hex");
    const key = path.posix.join(input.prefix, id.slice(0, 2), `${id}${ext}`);

    const res = await fetch(
      `${this.base}/storage/v1/object/${this.bucket}/${this.encodeKey(key)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          "Content-Type": input.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "x-upsert": "false",
        },
        body: new Uint8Array(input.buffer),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Supabase Storage upload failed (${res.status}): ${detail}`);
    }

    return {
      key,
      url: `${this.base}/storage/v1/object/public/${this.bucket}/${this.encodeKey(key)}`,
    };
  }

  async delete(key: string): Promise<void> {
    if (!key) return;
    // Best-effort — a missing object must not throw.
    await fetch(`${this.base}/storage/v1/object/${this.bucket}/${this.encodeKey(key)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.serviceRoleKey}` },
    }).catch(() => undefined);
  }
}
