import "server-only";

export class UpstreamError extends Error {
  constructor(message: string, public status?: number, public url?: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

const UA = "ASTRAE/0.1 (scientific research platform; server-side fetch)";

async function doFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 15000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "*/*", ...(rest.headers || {}) },
      cache: "no-store"
    });
    if (!res.ok) throw new UpstreamError(`Upstream responded ${res.status}`, res.status, url);
    return res;
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    const msg = (e as Error).name === "AbortError" ? "Upstream timeout" : (e as Error).message;
    throw new UpstreamError(msg, undefined, url);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const res = await doFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) } });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError("Upstream returned non-JSON content", res.status, url);
  }
}

export async function fetchText(url: string, init?: RequestInit & { timeoutMs?: number; encoding?: string }): Promise<string> {
  const res = await doFetch(url, init);
  if (init?.encoding) {
    const buf = await res.arrayBuffer();
    return new TextDecoder(init.encoding).decode(buf);
  }
  return res.text();
}
