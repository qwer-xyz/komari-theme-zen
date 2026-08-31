type CacheEntry = {
  value: unknown;
  expiresAt: number;
  lastAccessAt: number;
};

const resultCache = new Map<string, CacheEntry>();
const inflightQueries = new Map<string, Promise<unknown>>();
const MAX_CACHE_ENTRIES = 120;
let cacheGeneration = 0;

function pruneCache(): void {
  const now = Date.now();
  for (const [key, entry] of resultCache) {
    if (entry.expiresAt <= now) resultCache.delete(key);
  }

  if (resultCache.size <= MAX_CACHE_ENTRIES) return;
  const oldest = [...resultCache.entries()].sort(
    ([, a], [, b]) => a.lastAccessAt - b.lastAccessAt,
  );
  for (const [key] of oldest.slice(0, resultCache.size - MAX_CACHE_ENTRIES)) {
    resultCache.delete(key);
  }
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
    .join(",")}}`;
}

export function queryCacheKey(namespace: string, params?: unknown): string {
  return `${namespace}:${stableSerialize(params)}`;
}

export function cachedQuery<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const now = Date.now();
  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > now) {
    cached.lastAccessAt = now;
    return Promise.resolve(cached.value as T);
  }
  if (cached) resultCache.delete(key);

  const inflight = inflightQueries.get(key);
  if (inflight) return inflight as Promise<T>;

  const generation = cacheGeneration;
  const promise = loader()
    .then((value) => {
      if (generation === cacheGeneration) {
        resultCache.set(key, {
          value,
          expiresAt: Date.now() + Math.max(0, ttlMs),
          lastAccessAt: Date.now(),
        });
        pruneCache();
      }
      return value;
    })
    .finally(() => {
      if (inflightQueries.get(key) === promise) inflightQueries.delete(key);
    });
  inflightQueries.set(key, promise);
  return promise;
}

export function clearQueryCache(prefix?: string): void {
  cacheGeneration += 1;
  if (!prefix) {
    resultCache.clear();
    inflightQueries.clear();
    return;
  }
  for (const key of resultCache.keys()) {
    if (key.startsWith(prefix)) resultCache.delete(key);
  }
  for (const key of inflightQueries.keys()) {
    if (key.startsWith(prefix)) inflightQueries.delete(key);
  }
}
