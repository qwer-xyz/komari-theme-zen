import { hampelDespike } from "@/lib/recordTransform";
import type { PingRecord, PingTaskInfo } from "@/types/records";

export type PingPoint = { t: number; v: number };

export function buildProbeSeriesByTask(
  records: PingRecord[],
  taskId: number,
): PingPoint[] {
  const points: PingPoint[] = [];
  for (const rec of records) {
    if (rec.task_id !== taskId) continue;
    if (typeof rec.value !== "number" || !Number.isFinite(rec.value) || rec.value <= 0) {
      continue;
    }
    const t = new Date(rec.time).getTime();
    if (!Number.isFinite(t)) continue;
    points.push({ t, v: rec.value });
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

export function buildAllProbeSeries(
  records: PingRecord[],
  tasks: PingTaskInfo[],
): Record<string, PingPoint[]> {
  const map: Record<string, PingPoint[]> = {};
  for (const task of tasks) {
    map[String(task.id)] = buildProbeSeriesByTask(records, task.id);
  }
  return map;
}

export function computeRecordsTimeRange(
  records: PingRecord[],
): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const rec of records) {
    const t = new Date(rec.time).getTime();
    if (!Number.isFinite(t)) continue;
    min = Math.min(min, t);
    max = Math.max(max, t);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  return [min, max];
}

export function filterPointsToRange(
  points: PingPoint[],
  range: [number, number],
): PingPoint[] {
  const [start, end] = range;
  return points.filter((p) => p.t >= start && p.t <= end);
}

export function splitSeriesByGap(
  points: PingPoint[],
  maxGapMs: number,
): PingPoint[][] {
  if (points.length === 0) return [];
  const segments: PingPoint[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (cur.t - prev.t > maxGapMs) {
      segments.push([cur]);
    } else {
      segments[segments.length - 1].push(cur);
    }
  }
  return segments;
}

/** Hampel despike on per-probe time series (smooth toggle). */
export function despikePingSeries(
  points: PingPoint[],
  radius = 3,
  nSigma = 3,
): PingPoint[] {
  if (points.length === 0) return [];
  const values = points.map((p) => p.v);
  const cleaned = hampelDespike(values, radius, nSigma);
  return points.map((p, i) => ({
    t: p.t,
    v: cleaned[i] != null && Number.isFinite(cleaned[i]) ? cleaned[i]! : p.v,
  }));
}

function triangleArea(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  return Math.abs((ax - cx) * (by - ay) - (ax - bx) * (cy - ay)) * 0.5;
}

/** Largest-Triangle-Three-Buckets — preserves visual shape when decimating. */
export function lttbDownsample(points: PingPoint[], targetLen: number): PingPoint[] {
  if (targetLen <= 0) return [];
  if (points.length <= targetLen) return points.slice();
  if (targetLen === 1) return [points[0]];
  if (targetLen === 2) return [points[0], points[points.length - 1]];

  const sampled: PingPoint[] = [points[0]];
  const bucketSize = (points.length - 2) / (targetLen - 2);

  let prevSelected = 0;
  for (let i = 0; i < targetLen - 2; i++) {
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(
      points.length - 1,
      Math.floor((i + 2) * bucketSize) + 1,
    );

    const nextBucketStart = Math.floor((i + 2) * bucketSize) + 1;
    const nextBucketEnd = Math.min(
      points.length,
      Math.floor((i + 3) * bucketSize) + 1,
    );

    let avgX = 0;
    let avgY = 0;
    let avgCount = 0;
    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      avgX += points[j].t;
      avgY += points[j].v;
      avgCount++;
    }
    if (avgCount === 0) {
      avgX = points[points.length - 1].t;
      avgY = points[points.length - 1].v;
      avgCount = 1;
    } else {
      avgX /= avgCount;
      avgY /= avgCount;
    }

    const a = points[prevSelected];
    let maxArea = -1;
    let maxIdx = bucketStart;
    for (let j = bucketStart; j < bucketEnd; j++) {
      const area = triangleArea(a.t, a.v, points[j].t, points[j].v, avgX, avgY);
      if (area > maxArea) {
        maxArea = area;
        maxIdx = j;
      }
    }

    sampled.push(points[maxIdx]);
    prevSelected = maxIdx;
  }

  sampled.push(points[points.length - 1]);
  return sampled;
}

/** Min-max bucket downsample — keeps spikes visible in overview envelopes. */
export function minMaxDownsample(points: PingPoint[], targetLen: number): PingPoint[] {
  if (targetLen <= 0) return [];
  if (points.length <= targetLen) return points.slice();
  if (targetLen === 1) return [points[0]];

  const result: PingPoint[] = [points[0]];
  const bucketSize = (points.length - 2) / (targetLen - 2);

  for (let i = 0; i < targetLen - 2; i++) {
    const start = Math.floor(i * bucketSize) + 1;
    const end = Math.min(points.length - 1, Math.floor((i + 1) * bucketSize) + 1);
    if (start >= end) continue;

    let minP = points[start];
    let maxP = points[start];
    for (let j = start + 1; j < end; j++) {
      if (points[j].v < minP.v) minP = points[j];
      if (points[j].v > maxP.v) maxP = points[j];
    }
    if (minP.t <= maxP.t) {
      result.push(minP);
      if (maxP !== minP) result.push(maxP);
    } else {
      result.push(maxP);
      if (maxP !== minP) result.push(minP);
    }
  }

  result.push(points[points.length - 1]);
  result.sort((a, b) => a.t - b.t);
  return result;
}

export type DownsampleMode = "lttb" | "minmax";

export function downsamplePingSegment(
  points: PingPoint[],
  maxPoints: number,
  mode: DownsampleMode = "lttb",
): PingPoint[] {
  if (points.length <= maxPoints) return points.slice();
  return mode === "minmax"
    ? minMaxDownsample(points, maxPoints)
    : lttbDownsample(points, maxPoints);
}

/** Gap-split then downsample each segment. Returns drawable segments. */
export function downsamplePingSeries(
  points: PingPoint[],
  maxPoints: number,
  gapBreakMs?: number,
  mode: DownsampleMode = "lttb",
): PingPoint[][] {
  if (points.length === 0) return [];
  const segments =
    gapBreakMs != null && Number.isFinite(gapBreakMs)
      ? splitSeriesByGap(points, gapBreakMs)
      : [points];

  return segments.map((segment) => downsamplePingSegment(segment, maxPoints, mode));
}

export type ProbeDrawPlan = {
  /** Measured latency — solid lines only. */
  solidSegments: PingPoint[][];
  /** Straight connectors across collection gaps (no samples in between). */
  bridgeSegments: PingPoint[][];
};

/**
 * Build draw plan for one probe. When `connectBreakpoints` is false, gaps stay
 * open with no bridge lines. When true, dashed lines link segment endpoints.
 */
export function buildProbeDrawPlan(
  points: PingPoint[],
  maxPoints: number,
  gapBreakMs: number,
  connectBreakpoints: boolean,
  mode: DownsampleMode = "lttb",
): ProbeDrawPlan {
  if (points.length === 0) {
    return { solidSegments: [], bridgeSegments: [] };
  }

  const naturalSegments = splitSeriesByGap(points, gapBreakMs);
  const segCount = naturalSegments.length;
  const perSegBudget = Math.max(2, Math.floor(maxPoints / Math.max(1, segCount)));

  const solidSegments = naturalSegments.map((segment) =>
    downsamplePingSegment(segment, perSegBudget, mode),
  );

  if (!connectBreakpoints || segCount <= 1) {
    return { solidSegments, bridgeSegments: [] };
  }

  const bridgeSegments: PingPoint[][] = [];
  for (let i = 0; i < solidSegments.length - 1; i++) {
    const left = solidSegments[i];
    const right = solidSegments[i + 1];
    if (left.length === 0 || right.length === 0) continue;
    bridgeSegments.push([left[left.length - 1], right[0]]);
  }

  return { solidSegments, bridgeSegments };
}

const MIN_GAP_BREAK_MS = 5 * 60_000;

function medianGapMs(points: PingPoint[], sampleLimit = 256): number | null {
  if (points.length < 2) return null;
  const gaps: number[] = [];
  const step = Math.max(1, Math.floor((points.length - 1) / sampleLimit));
  for (let i = 1; i < points.length; i += step) {
    const gap = points[i].t - points[i - 1].t;
    if (gap > 0 && Number.isFinite(gap)) gaps.push(gap);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  return gaps[gaps.length >> 1];
}

/**
 * Break lines only on real collection gaps — not when configured interval is
 * smaller than the actual spacing in stored records.
 */
export function gapBreakMsForSeries(
  points: PingPoint[],
  task: PingTaskInfo,
  multiplier = 6,
): number {
  const intervalSec =
    typeof task.interval === "number" && task.interval > 0 ? task.interval : 60;
  const taskBasedMs = intervalSec * multiplier * 1000;
  const medianGap = medianGapMs(points);
  if (medianGap == null) {
    return Math.max(taskBasedMs, MIN_GAP_BREAK_MS);
  }
  return Math.max(taskBasedMs, medianGap * multiplier, MIN_GAP_BREAK_MS);
}

/** @deprecated Prefer {@link gapBreakMsForSeries} with the actual point series. */
export function gapBreakMsForTask(task: PingTaskInfo, multiplier = 3): number {
  const intervalSec =
    typeof task.interval === "number" && task.interval > 0 ? task.interval : 60;
  return Math.max(intervalSec * multiplier * 1000, MIN_GAP_BREAK_MS);
}

export function maxLatencyInPoints(
  segments: PingPoint[][],
  floor = 50,
): number {
  let max = floor;
  for (const segment of segments) {
    for (const p of segment) {
      if (Number.isFinite(p.v)) max = Math.max(max, p.v);
    }
  }
  return Math.ceil((max * 1.15) / 10) * 10;
}

/** Nearest sample time to target within sorted points (binary search). */
export function nearestPointTime(points: PingPoint[], targetT: number): number | null {
  if (points.length === 0) return null;
  if (targetT <= points[0].t) return points[0].t;
  if (targetT >= points[points.length - 1].t) return points[points.length - 1].t;

  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < targetT) lo = mid + 1;
    else hi = mid;
  }

  const right = lo;
  const left = right - 1;
  if (left < 0) return points[right].t;
  const dLeft = Math.abs(targetT - points[left].t);
  const dRight = Math.abs(points[right].t - targetT);
  return dLeft <= dRight ? points[left].t : points[right].t;
}

export type PingGap = {
  /** Last sample before the break. */
  afterT: number;
  /** First sample after the break. */
  beforeT: number;
  durationMs: number;
};

/** Real collection gaps — timestamps where no ping was recorded. */
export function findGapsInSeries(
  points: PingPoint[],
  gapBreakMs: number,
): PingGap[] {
  const gaps: PingGap[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const durationMs = cur.t - prev.t;
    if (durationMs > gapBreakMs) {
      gaps.push({ afterT: prev.t, beforeT: cur.t, durationMs });
    }
  }
  return gaps;
}

export function gapContainingTime(
  points: PingPoint[],
  gapBreakMs: number,
  targetT: number,
): PingGap | null {
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const durationMs = cur.t - prev.t;
    if (durationMs > gapBreakMs && targetT > prev.t && targetT < cur.t) {
      return { afterT: prev.t, beforeT: cur.t, durationMs };
    }
  }
  return null;
}

/** Nearest sample within tolerance; otherwise null (honest missing data). */
export function valueAtTime(
  points: PingPoint[],
  targetT: number,
  maxDistanceMs?: number,
): number | null {
  if (points.length === 0) return null;
  let best: PingPoint | null = null;
  let bestDist = Infinity;
  for (const p of points) {
    const d = Math.abs(p.t - targetT);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  if (best == null) return null;
  if (maxDistanceMs != null && bestDist > maxDistanceMs) return null;
  return best.v;
}

export function formatPingGapDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

/** Merge visible probe series into a sparse min/max envelope for overview. */
export function buildOverviewEnvelope(
  seriesMap: Record<string, PingPoint[]>,
  activeIds: string[],
  maxPoints = 200,
): PingPoint[] {
  const buckets = new Map<number, { min: number; max: number }>();
  const bucketMs = 60_000;

  for (const id of activeIds) {
    const points = seriesMap[id];
    if (!points) continue;
    for (const p of points) {
      const key = Math.floor(p.t / bucketMs);
      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, { min: p.v, max: p.v });
      } else {
        existing.min = Math.min(existing.min, p.v);
        existing.max = Math.max(existing.max, p.v);
      }
    }
  }

  const envelope: PingPoint[] = [];
  for (const [key, { min, max }] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    const t = key * bucketMs + bucketMs / 2;
    envelope.push({ t, v: min });
    if (max !== min) envelope.push({ t: t + 1, v: max });
  }

  return minMaxDownsample(envelope, maxPoints);
}
