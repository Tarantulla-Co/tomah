import path from "node:path";
import { env } from "../../config/env.js";
import { LocalDiskStorage } from "./local.js";
import { SupabaseStorage } from "./supabase.js";
import type { StorageAdapter } from "./types.js";

export type { StorageAdapter, StoredObject } from "./types.js";

/** Absolute path to the local upload directory (also used to mount static). */
export const localUploadDir = path.isAbsolute(env.STORAGE_LOCAL_DIR)
  ? env.STORAGE_LOCAL_DIR
  : path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);

function build(): StorageAdapter {
  switch (env.STORAGE_ADAPTER) {
    case "supabase":
      return new SupabaseStorage(
        env.SUPABASE_URL as string,
        env.SUPABASE_SERVICE_ROLE_KEY as string,
        env.SUPABASE_STORAGE_BUCKET,
      );
    case "local":
    default:
      return new LocalDiskStorage(localUploadDir, env.ASSET_PUBLIC_BASE_URL);
  }
}

export const storage: StorageAdapter = build();

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
