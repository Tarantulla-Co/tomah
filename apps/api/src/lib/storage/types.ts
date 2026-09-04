/**
 * Object storage abstraction for user-uploaded assets (product images today).
 *
 * Local disk is the default implementation. Swap in S3 / GCS / Cloudinary /
 * etc. later by adding another adapter and pointing STORAGE_ADAPTER at it —
 * no controller changes required. Same swappable-adapter pattern as the
 * accounting integration.
 */
export interface StoredObject {
  /** Adapter-specific key. Persisted on the row so a delete can remove the file. */
  key: string;
  /** Publicly reachable URL for the stored object. */
  url: string;
}

export interface PutObjectInput {
  buffer: Buffer;
  contentType: string;
  /** Logical folder, e.g. "products". */
  prefix: string;
  /** Original filename — used only to derive an extension. */
  filename: string;
}

export interface StorageAdapter {
  readonly name: string;
  put(input: PutObjectInput): Promise<StoredObject>;
  /** Best-effort; must not throw if the object is already gone. */
  delete(key: string): Promise<void>;
}
