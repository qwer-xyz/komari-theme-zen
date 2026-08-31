export function finiteNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function nonNegativeNumber(value: unknown, fallback = 0): number {
  return Math.max(0, finiteNumber(value, fallback));
}

export function safePercent(used: unknown, total: unknown): number {
  const normalizedUsed = finiteNumber(used);
  const normalizedTotal = finiteNumber(total);
  if (normalizedTotal <= 0) return 0;
  return Math.max(0, Math.min(100, (normalizedUsed / normalizedTotal) * 100));
}

const MIN_REASONABLE_TIMESTAMP_MS = Date.UTC(2000, 0, 1);
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

function reasonableTimestamp(value: number): number | null {
  const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
  return milliseconds >= MIN_REASONABLE_TIMESTAMP_MS &&
    milliseconds <= Date.now() + MAX_FUTURE_SKEW_MS
    ? milliseconds
    : null;
}

export function timestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return reasonableTimestamp(value);
  }

  if (typeof value !== "string" || !value.trim()) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return reasonableTimestamp(numeric);
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? reasonableTimestamp(parsed) : null;
}
