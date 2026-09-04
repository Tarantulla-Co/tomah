/**
 * API client. Holds the short-lived access token in memory only (never
 * localStorage). The refresh token lives in an httpOnly cookie the browser
 * sends automatically to /auth/refresh. On a 401 the client transparently
 * refreshes once and retries.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setAuthLostHandler(fn: () => void) {
  onAuthLost = fn;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the automatic refresh-and-retry (used by auth calls themselves). */
  skipRefresh?: boolean;
}

async function raw<T>(path: string, opts: RequestOptions): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
    signal: opts.signal,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const err = payload?.error ?? {};
    throw new ApiError(res.status, err.code ?? "ERROR", err.message ?? res.statusText, err.details);
  }
  return payload as T;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = raw<{ accessToken: string }>("/auth/refresh", {
      method: "POST",
      skipRefresh: true,
    })
      .then((r) => {
        accessToken = r.accessToken;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await raw<T>(path, opts);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && !opts.skipRefresh) {
      const ok = await tryRefresh();
      if (ok) return raw<T>(path, opts);
      accessToken = null;
      onAuthLost?.();
    }
    throw e;
  }
}

export const apiGet = <T,>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const apiPost = <T,>(path: string, body?: unknown, o: RequestOptions = {}) =>
  api<T>(path, { ...o, method: "POST", body });
export const apiPatch = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body });
export const apiDelete = <T,>(path: string) => api<T>(path, { method: "DELETE" });

/** Multipart upload (FormData). Same auth + single refresh-and-retry as `api`. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const send = async (): Promise<Response> =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
      credentials: "include",
    });

  let res = await send();
  if (res.status === 401) {
    const ok = await tryRefresh();
    if (ok) res = await send();
    else {
      accessToken = null;
      onAuthLost?.();
    }
  }

  const text = await res.text();
  const payload = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const err = payload?.error ?? {};
    throw new ApiError(res.status, err.code ?? "ERROR", err.message ?? res.statusText, err.details);
  }
  return payload as T;
}
