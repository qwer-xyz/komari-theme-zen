import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LivePingStat, LiveRecord } from "@/types/LiveData";
import type {
  LoadRecord,
  MetricKey,
  PingRecord,
  PingTaskInfo,
} from "@/types/records";
import { hoursToChartLength } from "@/lib/timeRangePresets";
import type { VPSNode } from "@/types";
import { bytesToGb } from "@/lib/komariMapper";
import {
  LATENCY_HISTORY_LEN,
  type LatencySample,
} from "@/lib/latencyDisplay";

/** Distinct probe line colors — follow active chart tokens so presets stay coherent. */
const PING_COLOR_VARS = [
  "var(--zen-chart-mem)",
  "var(--zen-chart-load)",
  "var(--zen-chart-cpu)",
  "var(--zen-chart-net-out)",
  "var(--zen-chart-swap)",
  "var(--zen-chart-net-in)",
  "var(--zen-chart-udp)",
  "var(--zen-danger)",
] as const;

export function taskColor(index: number): string {
  return PING_COLOR_VARS[index % PING_COLOR_VARS.length];
}

export type LoadTotals = {
  memTotal: number;
  swapTotal: number;
  diskTotal: number;
};

export type MetricHistoryResult = {
  values: (number | null)[];
  hasData: boolean;
};

/** Map raw load average to 0–100 chart space by logical core count. */
export function loadToChartPercent(load: number, cpuCores: number): number {
  if (!cpuCores || cpuCores <= 0) return 0;
  return (load / cpuCores) * 100;
}

export function formatLoadAverage(load: number): string {
  return load.toFixed(2);
}

export function normalizeLoadSeries(
  values: (number | null)[],
  cpuCores: number,
): (number | null)[] {
  return values.map((v) =>
    v == null ? null : loadToChartPercent(v, cpuCores),
  );
}

export function resolveDiskUsedGb(
  liveDisk: number | undefined,
  diskTotalGb: number,
): number {
  if (!liveDisk || liveDisk <= 0 || diskTotalGb <= 0) return 0;
  if (liveDisk <= 100) return (liveDisk / 100) * diskTotalGb;
  return bytesToGb(liveDisk);
}

export function resolveSwapUsedGb(
  liveSwap: number | undefined,
  swapTotalGb: number,
): number {
  if (!liveSwap || liveSwap <= 0) return 0;
  if (liveSwap <= 100 && swapTotalGb > 0) return (liveSwap / 100) * swapTotalGb;
  return bytesToGb(liveSwap);
}

export function resolveTrafficLimitGb(node: NodeBasicInfo): number {
  if (!node.traffic_limit || node.traffic_limit <= 0) return 0;
  return bytesToGb(node.traffic_limit);
}

export function downsampleSeries(values: number[], targetLen: number): number[] {
  if (targetLen <= 0) return [];
  if (values.length === 0) return Array(targetLen).fill(0);
  if (values.length === targetLen) return values;
  if (values.length === 1) return Array(targetLen).fill(values[0]);

  const result: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const pos = (i / (targetLen - 1)) * (values.length - 1);
    const idx = Math.round(pos);
    result.push(values[Math.min(values.length - 1, idx)]);
  }
  return result;
}

function sortedMedian(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  return sortedMedian([...values].sort((a, b) => a - b));
}

/**
 * Hampel filter — robust spike removal. For each point it computes the median
 * and MAD (median absolute deviation) of a sliding window; points further than
 * `nSigma * 1.4826 * MAD` from the local median are treated as outliers and
 * replaced by that median. Median/MAD are robust to the outliers themselves,
 * so this still works on very noisy data where mean-based detection fails.
 * Genuine level-shifts survive; `null` gaps are left untouched.
 */
export function hampelDespike(
  series: (number | null)[],
  radius = 3,
  nSigma = 3,
): (number | null)[] {
  const n = series.length;
  const out = series.slice();
  for (let i = 0; i < n; i++) {
    const x = series[i];
    if (x == null || !Number.isFinite(x)) continue;
    const win: number[] = [];
    for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) {
      const v = series[j];
      if (v != null && Number.isFinite(v)) win.push(v);
    }
    if (win.length < 3) continue;
    const m = medianOf(win);
    const mad = medianOf(win.map((v) => Math.abs(v - m)));
    // 1.4826 makes MAD a consistent estimator of the std-dev for normal data.
    // Floor with a small fraction of the median so an isolated spike on an
    // otherwise-flat line is still caught (MAD can be 0 there).
    const scale = Math.max(1.4826 * mad, 0.05 * m, 1e-9);
    if (Math.abs(x - m) > nSigma * scale) {
      out[i] = m;
    }
  }
  return out;
}

/** Bucket-mean downsample: averages each bucket, anti-aliasing dense data. */
export function downsampleSeriesAvg(values: number[], targetLen: number): number[] {
  if (targetLen <= 0) return [];
  if (values.length === 0) return Array(targetLen).fill(0);
  if (values.length <= targetLen) return downsampleSeries(values, targetLen);

  const result: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const start = Math.floor((i * values.length) / targetLen);
    const end = Math.max(
      start + 1,
      Math.floor(((i + 1) * values.length) / targetLen),
    );
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < values.length; j++) {
      sum += values[j];
      count++;
    }
    result.push(
      count > 0 ? sum / count : values[Math.min(values.length - 1, start)],
    );
  }
  return result;
}

/** Centered triangular moving average — smooth, zero phase lag, no staircases. */
export function smoothSeriesTriangular(values: number[], radius = 2): number[] {
  if (radius <= 0 || values.length < 3) return values.slice();
  const n = values.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let weight = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) {
      const w = radius + 1 - Math.abs(i - j);
      sum += values[j] * w;
      weight += w;
    }
    out[i] = weight > 0 ? sum / weight : values[i];
  }
  return out;
}

export function loadMetricValue(
  rec: LoadRecord,
  metric: MetricKey,
  totals: LoadTotals,
): number {
  switch (metric) {
    case "cpu":
      return rec.cpu ?? 0;
    case "mem": {
      const total = rec.ram_total ?? totals.memTotal;
      if (!total) return 0;
      return ((rec.ram ?? 0) / total) * 100;
    }
    case "swap": {
      const total = rec.swap_total ?? totals.swapTotal;
      if (!total) return 0;
      return ((rec.swap ?? 0) / total) * 100;
    }
    case "disk": {
      const total = rec.disk_total ?? totals.diskTotal;
      if (!total) return 0;
      return ((rec.disk ?? 0) / total) * 100;
    }
    case "netin":
      return rec.net_in ?? 0;
    case "netout":
      return rec.net_out ?? 0;
    case "tcp":
      return rec.connections ?? 0;
    case "udp":
      return rec.connections_udp ?? 0;
    case "processes":
      return rec.process ?? 0;
    case "load1":
      return rec.load ?? 0;
  }
}

export function alignLoadRecordsToChart(
  records: LoadRecord[],
  metric: MetricKey,
  totals: LoadTotals,
  rangeHours: number,
  targetLen: number,
): (number | null)[] {
  if (records.length === 0 || targetLen <= 0) {
    return Array(targetLen).fill(null);
  }

  const sorted = [...records].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );

  const lastMs = new Date(sorted[sorted.length - 1].time).getTime();
  const endMs = lastMs;
  const startMs = endMs - rangeHours * 3600 * 1000;
  const span = endMs - startMs;
  const slotMs = span / targetLen;

  const buckets: number[][] = Array.from({ length: targetLen }, () => []);

  for (const rec of sorted) {
    const ts = new Date(rec.time).getTime();
    if (ts < startMs || ts > endMs) continue;
    const idx = Math.min(
      targetLen - 1,
      Math.max(0, Math.floor((ts - startMs) / slotMs)),
    );
    buckets[idx].push(loadMetricValue(rec, metric, totals));
  }

  return buckets.map((bucket) => {
    if (bucket.length === 0) return null;
    return bucket.reduce((s, v) => s + v, 0) / bucket.length;
  });
}

export function padSeriesLeft(
  values: number[],
  targetLen: number,
): (number | null)[] {
  if (targetLen <= 0) return [];
  const out: (number | null)[] = Array(targetLen).fill(null);
  const copyLen = Math.min(values.length, targetLen);
  const offset = targetLen - copyLen;
  for (let i = 0; i < copyLen; i++) {
    out[offset + i] = values[i];
  }
  return out;
}

export function recentMetricValue(
  rec: LiveRecord,
  metric: MetricKey,
  totals?: LoadTotals,
): number {
  switch (metric) {
    case "cpu":
      return rec.cpu.usage ?? 0;
    case "mem": {
      const total = rec.ram.total ?? totals?.memTotal ?? 0;
      if (total > 0) return (rec.ram.used / total) * 100;
      return 0;
    }
    case "swap": {
      const total = rec.swap.total ?? totals?.swapTotal ?? 0;
      if (total > 0) return (rec.swap.used / total) * 100;
      return 0;
    }
    case "disk": {
      const total = rec.disk.total ?? totals?.diskTotal ?? 0;
      if (total > 0) return (rec.disk.used / total) * 100;
      return rec.disk.used <= 100 ? rec.disk.used : 0;
    }
    case "netin":
      return rec.network.down ?? 0;
    case "netout":
      return rec.network.up ?? 0;
    case "tcp":
      return rec.connections.tcp ?? 0;
    case "udp":
      return rec.connections.udp ?? 0;
    case "processes":
      return rec.process ?? 0;
    case "load1":
      return rec.load.load1 ?? 0;
  }
}

export function recentToSparkline(
  records: LiveRecord[],
  metric: MetricKey,
  totals?: LoadTotals,
): number[] {
  return records.map((r) => recentMetricValue(r, metric, totals));
}

export function buildMetricHistory(
  metric: MetricKey,
  hours: number,
  totals: LoadTotals,
  loadRecords: LoadRecord[],
  recentRecords: LiveRecord[],
): MetricHistoryResult {
  const targetLen = hoursToChartLength(hours);
  const rangeHours = hours;

  if (loadRecords.length > 0) {
    const values = alignLoadRecordsToChart(
      loadRecords,
      metric,
      totals,
      rangeHours,
      targetLen,
    );
    const hasData = values.some((v) => v > 0);
    return { values, hasData: hasData || loadRecords.length > 0 };
  }

  if (
    hours <= 24 &&
    recentRecords.length > 0 &&
    (metric === "cpu" ||
      metric === "mem" ||
      metric === "netin" ||
      metric === "netout" ||
      metric === "load1")
  ) {
    const series = recentToSparkline(recentRecords, metric, totals);
    const values = padSeriesLeft(
      downsampleSeries(series, Math.min(series.length, targetLen)),
      targetLen,
    );
    return { values, hasData: series.length > 0 };
  }

  return { values: Array(targetLen).fill(0), hasData: false };
}

function averagePositive(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function aggregateLatency(tasks: PingTaskInfo[]): number {
  const values = tasks
    .map((t) => t.latest ?? t.avg)
    .filter((v): v is number => typeof v === "number" && v > 0);
  return averagePositive(values);
}

/** Average latest/avg latency across live ping stats from getNodesLatestStatus. */
export function aggregateLivePing(
  ping: Record<string, { latest?: number; avg?: number }> | undefined,
): number {
  if (!ping) return 0;
  const values = Object.values(ping)
    .map((p) => p.latest ?? p.avg)
    .filter((v): v is number => typeof v === "number" && v > 0);
  return averagePositive(values);
}

export function parseLivePing(raw: unknown): Record<string, LivePingStat> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") return undefined;
  const out: Record<string, LivePingStat> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue;
    const p = val as Record<string, unknown>;
    out[key] = {
      name: typeof p.name === "string" ? p.name : undefined,
      latest: typeof p.latest === "number" ? p.latest : undefined,
      avg: typeof p.avg === "number" ? p.avg : undefined,
      loss: typeof p.loss === "number" ? p.loss : undefined,
      min: typeof p.min === "number" ? p.min : undefined,
      max: typeof p.max === "number" ? p.max : undefined,
      tail: typeof p.tail === "number" ? p.tail : undefined,
    };
  }
  return out;
}

/**
 * Robust ping volatility — a robust coefficient of variation.
 * `σ̂ = 1.4826 * MAD` is a spike-resistant estimate of the std-dev, normalised
 * by the clamped median. Unlike `(P99 - P50)`, MAD reflects the *typical*
 * spread rather than the single worst sample, so the value is stable and
 * low-error. The `max(min(median, 50), 10)` clamp keeps low-latency probes
 * from inflating and matches the scale of the official Komari metric.
 */
export function computePingVolatility(values: number[]): number {
  const valid = values.filter((v) => v > 0 && Number.isFinite(v));
  if (valid.length < 4) return 0;
  const sorted = [...valid].sort((a, b) => a - b);
  const m = sortedMedian(sorted);
  const mad = medianOf(sorted.map((v) => Math.abs(v - m)));
  const sigma = 1.4826 * mad;
  const denom = Math.max(Math.min(m, 50), 10);
  return sigma / denom;
}

export function taskPingVolatility(
  _task: PingTaskInfo,
  series?: number[],
): number | null {
  // Need a minimum sample count to be meaningful; a perfectly stable probe
  // still returns 0 (shown as 0.00) rather than being hidden.
  if (series && series.length >= 4) {
    const computed = computePingVolatility(series);
    if (Number.isFinite(computed)) return computed;
  }
  return null;
}

/** Last N aggregated ping samples (average latency per time anchor) for card blocks. */
export function pingRecordsToLatencyHistory(
  records: PingRecord[],
  tasks: PingTaskInfo[],
  maxLen = LATENCY_HISTORY_LEN,
): LatencySample[] {
  if (!records.length) return [];

  const { anchors, grouped } = groupPingRecordsByTime(records, tasks);
  const samples: LatencySample[] = [];

  for (const anchor of anchors) {
    const values = Object.values(grouped[anchor] ?? {}).filter(
      (v): v is number => typeof v === "number" && v > 0,
    );
    if (values.length === 0) continue;
    samples.push({ ms: averagePositive(values), t: anchor });
  }

  return samples.slice(-maxLen);
}

export function groupPingRecordsByTime(
  records: PingRecord[],
  tasks: PingTaskInfo[],
): { anchors: number[]; grouped: Record<number, Record<number, number>> } {
  const taskIntervals = tasks
    .map((t) => t.interval)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const fallbackIntervalSec = taskIntervals.length
    ? Math.min(...taskIntervals)
    : 60;
  const toleranceMs = Math.min(
    6000,
    Math.max(800, Math.floor(fallbackIntervalSec * 1000 * 0.25)),
  );

  const grouped: Record<number, Record<number, number>> = {};
  const anchors: number[] = [];

  for (const rec of records) {
    const ts = new Date(rec.time).getTime();
    let anchor: number | null = null;
    for (const a of anchors) {
      if (Math.abs(a - ts) <= toleranceMs) {
        anchor = a;
        break;
      }
    }
    const use = anchor ?? ts;
    if (anchor === null) anchors.push(use);
    if (!grouped[use]) grouped[use] = {};
    grouped[use][rec.task_id] = rec.value;
  }

  anchors.sort((a, b) => a - b);
  return { anchors, grouped };
}

export function buildPingChartRows(
  anchors: number[],
  grouped: Record<number, Record<number, number>>,
  tasks: PingTaskInfo[],
): Array<{ time: string; [key: string]: string | number | null }> {
  return anchors.map((a) => {
    const row: { time: string; [key: string]: string | number | null } = {
      time: new Date(a).toISOString(),
    };
    for (const task of tasks) {
      const val = grouped[a]?.[task.id];
      row[String(task.id)] =
        val !== undefined && val >= 0 ? val : null;
    }
    return row;
  });
}

export function buildProbeSeriesFromRows(
  rows: Array<{ time: string; [key: string]: string | number | null }>,
  taskId: number,
): number[] {
  const key = String(taskId);
  return rows.map((r) => {
    const v = r[key];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  });
}

/** Like {@link buildProbeSeriesFromRows} but preserves null gaps for broken line charts. */
export function buildProbeSeriesNullableFromRows(
  rows: Array<{ time: string; [key: string]: string | number | null }>,
  taskId: number,
): (number | null)[] {
  const key = String(taskId);
  return rows.map((r) => {
    const v = r[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  });
}

export function downsampleSeriesNullable(
  values: (number | null)[],
  targetLen: number,
): (number | null)[] {
  if (targetLen <= 0) return [];
  if (values.length === 0) return Array(targetLen).fill(null);
  if (values.length === targetLen) return values.slice();
  if (values.length === 1) {
    const only = values[0];
    return Array(targetLen).fill(only);
  }

  const result: (number | null)[] = [];
  for (let i = 0; i < targetLen; i++) {
    const pos = (i / (targetLen - 1)) * (values.length - 1);
    const idx = Math.round(pos);
    const v = values[Math.min(values.length - 1, idx)];
    result.push(v != null && Number.isFinite(v) ? v : null);
  }
  return result;
}

export function downsampleSeriesAvgNullable(
  values: (number | null)[],
  targetLen: number,
): (number | null)[] {
  if (targetLen <= 0) return [];
  if (values.length === 0) return Array(targetLen).fill(null);
  if (values.length <= targetLen) return downsampleSeriesNullable(values, targetLen);

  const result: (number | null)[] = [];
  for (let i = 0; i < targetLen; i++) {
    const start = Math.floor((i * values.length) / targetLen);
    const end = Math.max(
      start + 1,
      Math.floor(((i + 1) * values.length) / targetLen),
    );
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < values.length; j++) {
      const v = values[j];
      if (v == null || !Number.isFinite(v)) continue;
      sum += v;
      count++;
    }
    result.push(count > 0 ? sum / count : null);
  }
  return result;
}

/** Centered triangular MA that skips null gaps. */
export function smoothSeriesTriangularNullable(
  values: (number | null)[],
  radius = 2,
): (number | null)[] {
  if (radius <= 0 || values.length < 3) return values.slice();
  const n = values.length;
  const out: (number | null)[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const current = values[i];
    if (current == null || !Number.isFinite(current)) {
      out[i] = null;
      continue;
    }
    let sum = 0;
    let weight = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) {
      const v = values[j];
      if (v == null || !Number.isFinite(v)) continue;
      const w = radius + 1 - Math.abs(i - j);
      sum += v * w;
      weight += w;
    }
    out[i] = weight > 0 ? sum / weight : current;
  }
  return out;
}

export function buildProbeSeries(
  anchors: number[],
  grouped: Record<number, Record<number, number>>,
  taskId: number,
): number[] {
  return anchors.map((a) => grouped[a]?.[taskId] ?? 0);
}

export function interpolateNullsLinear<T extends { [key: string]: unknown }>(
  rows: T[],
  keys: string[],
  options?: {
    maxGapMs?: number;
    maxGapMultiplier?: number;
    minCapMs?: number;
    maxCapMs?: number;
  },
): T[] {
  if (!rows || rows.length === 0 || !keys.length) return rows;

  const times = rows.map((r) =>
    new Date(String((r as { time?: string }).time ?? "")).getTime(),
  );
  const out = rows.map((r) => ({ ...r }));
  const opts = options || {};
  const maxGapMsUnified = opts.maxGapMs;
  const multiplier = opts.maxGapMultiplier ?? 6;
  const minCap = opts.minCapMs ?? 2 * 60_000;
  const maxCap = opts.maxCapMs ?? 30 * 60_000;

  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));

  for (const key of keys) {
    const validIdx: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const v = rows[i][key];
      if (typeof v === "number" && Number.isFinite(v)) validIdx.push(i);
    }
    if (validIdx.length < 2) continue;

    let perKeyMaxGap = maxGapMsUnified;
    if (perKeyMaxGap === undefined) {
      const gaps: number[] = [];
      for (let s = 0; s < validIdx.length - 1; s++) {
        const t0 = times[validIdx[s]];
        const t1 = times[validIdx[s + 1]];
        if (Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0) {
          gaps.push(t1 - t0);
        }
      }
      if (gaps.length === 0) continue;
      gaps.sort((a, b) => a - b);
      const median = gaps[(gaps.length / 2) | 0];
      perKeyMaxGap = clamp(median * multiplier, minCap, maxCap);
    }

    for (let s = 0; s < validIdx.length - 1; s++) {
      const i0 = validIdx[s];
      const i1 = validIdx[s + 1];
      const t0 = times[i0];
      const t1 = times[i1];
      const v0 = rows[i0][key];
      const v1 = rows[i1][key];

      if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue;
      if (typeof v0 !== "number" || typeof v1 !== "number") continue;
      if (perKeyMaxGap && t1 - t0 > perKeyMaxGap) continue;

      for (let j = i0 + 1; j < i1; j++) {
        const tj = times[j];
        const ratio = (tj - t0) / (t1 - t0);
        (out[j] as Record<string, unknown>)[key] = v0 + (v1 - v0) * ratio;
      }
    }
  }

  return out;
}

/**
 * Despike one series per key with the Hampel filter. Isolated spikes are
 * replaced by the local median; genuine level-shifts are preserved and `null`
 * gaps are left for later interpolation. Final smoothing for display happens
 * downstream via {@link downsampleSeriesAvg} + {@link smoothSeriesTriangular}.
 */
export function cutPeakValues<T extends { [key: string]: unknown }>(
  data: T[],
  keys: string[],
  radius = 3,
  nSigma = 3,
): T[] {
  if (!data || data.length === 0) return data;

  const result = data.map((row) => ({ ...row }));

  for (const key of keys) {
    const series = result.map((row) => {
      const v = row[key];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }) as (number | null)[];

    const despiked = hampelDespike(series, radius, nSigma);

    for (let i = 0; i < result.length; i++) {
      if (despiked[i] !== series[i]) {
        (result[i] as Record<string, unknown>)[key] = despiked[i];
      }
    }
  }

  return result;
}

export function loadTotalsFromNode(node: VPSNode): LoadTotals {
  const GB = 1024 ** 3;
  return {
    memTotal: node.memoryTotal * GB,
    swapTotal: node.swapTotal * GB,
    diskTotal: node.diskTotal * GB,
  };
}
