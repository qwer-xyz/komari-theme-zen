type CacheEntry = {
  value: unknown;
  expiresAt: number;
  lastAccessAt: number;
  size: number;
};
type Flight = {
  promise: Promise<unknown>;
  controller: AbortController;
  consumers: number;
};
const resultCache = new Map<string, CacheEntry>();
const inflightQueries = new Map<string, Flight>();
const MAX_BYTES = 16 * 1024 * 1024;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

// Bound traversal and avoid allocating a serialized copy of large histories.
function estimateSize(value: unknown, limit = MAX_BYTES / 4): number {
  let size = 0;
  const seen = new Set<object>();
  const visit = (item: unknown) => {
    if (size > limit) return;
    if (typeof item === "string") {
      size += item.length * 2;
      return;
    }
    if (!item || typeof item !== "object") {
      size += 8;
      return;
    }
    if (seen.has(item)) return;
    seen.add(item);
    size += 32;
    for (const key in item) {
      if (!Object.hasOwn(item, key)) continue;
      size += key.length * 2 + 8;
      visit((item as Record<string, unknown>)[key]);
      if (size > limit) break;
    }
  };
  visit(value);
  return size;
}
function pruneCache() {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = undefined;
  const now = Date.now();
  for (const [key, entry] of resultCache)
    if (entry.expiresAt <= now) resultCache.delete(key);
  let bytes = [...resultCache.values()].reduce(
    (sum, entry) => sum + entry.size,
    0,
  );
  for (const [key, entry] of [...resultCache].sort(
    (a, b) => a[1].lastAccessAt - b[1].lastAccessAt,
  )) {
    if (bytes <= MAX_BYTES && resultCache.size <= 120) break;
    resultCache.delete(key);
    bytes -= entry.size;
  }
  if (resultCache.size) {
    const next = Math.min(
      ...[...resultCache.values()].map((entry) => entry.expiresAt),
    );
    expiryTimer = setTimeout(pruneCache, Math.max(1, next - now));
    (expiryTimer as unknown as { unref?: () => void }).unref?.();
  }
}
function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
    .join(",")}}`;
}
export function queryCacheKey(namespace: string, params?: unknown): string {
  return `${namespace}:${stableSerialize(params)}`;
}
export function cachedQuery<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  ttlMs: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    cached.lastAccessAt = Date.now();
    return Promise.resolve(cached.value as T);
  }
  if (cached) resultCache.delete(key);
  let flight = inflightQueries.get(key);
  if (!flight) {
    const controller = new AbortController();
    const entry: Flight = { controller, consumers: 0, promise: undefined! };
    let loaded: Promise<T>;
    try {
      loaded = loader(controller.signal);
    } catch (error) {
      loaded = Promise.reject(error);
    }
    entry.promise = loaded
      .then((value) => {
        if (inflightQueries.get(key) === entry && !controller.signal.aborted) {
          const size = estimateSize(value);
          if (size <= MAX_BYTES / 4 && ttlMs > 0)
            resultCache.set(key, {
              value,
              size,
              expiresAt: Date.now() + ttlMs,
              lastAccessAt: Date.now(),
            });
          pruneCache();
        }
        return value;
      })
      .finally(() => {
        if (inflightQueries.get(key) === entry) inflightQueries.delete(key);
      });
    inflightQueries.set(key, entry);
    flight = entry;
  }
  const active = flight;
  active.consumers++;
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const finish = (callback: () => void) => {
      if (done) return;
      done = true;
      signal?.removeEventListener("abort", abort);
      active.consumers--;
      callback();
      if (active.consumers === 0 && inflightQueries.get(key) === active) {
        inflightQueries.delete(key);
        active.controller.abort();
      }
    };
    const abort = () => finish(() => reject(signal?.reason));
    signal?.addEventListener("abort", abort, { once: true });
    active.promise.then(
      (value) => finish(() => resolve(value as T)),
      (error) => finish(() => reject(error)),
    );
  });
}
export function clearQueryCache(prefix?: string): void {
  for (const key of resultCache.keys())
    if (!prefix || key.startsWith(prefix)) resultCache.delete(key);
  // Invalidate writeback without cancelling existing subscribers.
  for (const key of inflightQueries.keys())
    if (!prefix || key.startsWith(prefix)) inflightQueries.delete(key);
  pruneCache();
}
