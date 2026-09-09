let running = 0;
const waiting: Array<() => void> = [];
/** Share a transport budget across all history consumers. */
export async function scheduleHistory<T>(
  loader: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const start = () => {
      signal.removeEventListener("abort", abort);
      running++;
      resolve();
    };
    const abort = () => {
      const i = waiting.indexOf(start);
      if (i >= 0) waiting.splice(i, 1);
      reject(signal.reason);
    };
    if (running < 3) start();
    else {
      waiting.push(start);
      signal.addEventListener("abort", abort, { once: true });
    }
  });
  try {
    signal.throwIfAborted();
    return await loader();
  } finally {
    running--;
    waiting.shift()?.();
  }
}
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
  signal: AbortSignal,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (!signal.aborted && index < items.length) {
        const slot = index++;
        results[slot] = await mapper(items[slot]);
      }
    }),
  );
  return results;
}
