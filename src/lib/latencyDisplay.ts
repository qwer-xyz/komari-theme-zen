import { parseThemeSelectOption } from "@/lib/themeOptionValue";

export type LatencySample = { ms: number; t: number };

/** CPU / mem / disk bar segment count in NodeTable. */
export const METRIC_BAR_SEGMENTS = 10;

/** Fixed rem widths — independent of font metrics. */
export const METRIC_VALUE_WIDTH = "3.375rem";
export const METRIC_BAR_WIDTH = "4.75rem";

/** Value column + segment track — aligns rows when right-aligned. */
export const metricWidgetGridClass =
  "inline-grid shrink-0 items-center gap-x-1 tabular-nums font-mono grid-cols-[3.375rem_4.75rem]";

/** @deprecated Use metricWidgetGridClass */
export const metricWidgetClass = metricWidgetGridClass;

/** Latency sparkline blocks — 2× segments, rendered half-size in the same bar width. */
export const LATENCY_HISTORY_LEN = METRIC_BAR_SEGMENTS * 2;

export type LatencyColorMode = "Fixed" | "MeanDelta";

export type LatencyColorConfig = {
  mode: LatencyColorMode;
  fixedGreenMax: number;
  fixedYellowMax: number;
  meanGreenDelta: number;
  meanYellowDelta: number;
};

export const DEFAULT_LATENCY_COLOR_CONFIG: LatencyColorConfig = {
  mode: "Fixed",
  fixedGreenMax: 100,
  fixedYellowMax: 150,
  meanGreenDelta: 10,
  meanYellowDelta: 30,
};

export type LatencyTier = "empty" | "green" | "yellow" | "red";

const MIN_MEAN_SAMPLES = 2;

/** Format latency for labels (e.g. 27.0ms, 177ms). */
export function formatLatencyMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return ms >= 100 ? `${ms.toFixed(0)}ms` : `${ms.toFixed(1)}ms`;
}

export function formatLatencyTooltipTime(t: number): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function formatLatencyDelta(delta: number): string {
  if (!Number.isFinite(delta)) return "";
  const sign = delta >= 0 ? "+" : "";
  const val = Math.abs(delta) >= 100 ? delta.toFixed(0) : delta.toFixed(1);
  return `Δ${sign}${val}`;
}

export function computeLatencyMean(samples: LatencySample[]): number | null {
  const values = samples.filter((s) => s.ms > 0).map((s) => s.ms);
  if (values.length < MIN_MEAN_SAMPLES) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function resolveFixedTier(ms: number, config: LatencyColorConfig): LatencyTier {
  if (ms < config.fixedGreenMax) return "green";
  if (ms < config.fixedYellowMax) return "yellow";
  return "red";
}

function resolveMeanDeltaTier(
  ms: number,
  mean: number,
  config: LatencyColorConfig,
): LatencyTier {
  const delta = ms - mean;
  if (delta <= config.meanGreenDelta) return "green";
  if (delta <= config.meanYellowDelta) return "yellow";
  return "red";
}

export function resolveLatencyTier(
  ms: number,
  config: LatencyColorConfig,
  mean: number | null,
): LatencyTier {
  if (!Number.isFinite(ms) || ms <= 0) return "empty";

  if (config.mode === "MeanDelta" && mean != null && mean > 0) {
    return resolveMeanDeltaTier(ms, mean, config);
  }
  return resolveFixedTier(ms, config);
}

/** Muted tier colors for latency blocks. */
export function latencyTierColor(tier: LatencyTier): string {
  if (tier === "empty") {
    return "text-zen-fg-faint/80";
  }
  if (tier === "green") {
    return "text-zen-success";
  }
  if (tier === "yellow") {
    return "text-zen-warning";
  }
  return "text-zen-danger";
}

export function latencyBlockColor(
  ms: number,
  _theme: "light" | "dark",
  config: LatencyColorConfig = DEFAULT_LATENCY_COLOR_CONFIG,
  mean: number | null = null,
): string {
  return latencyTierColor(resolveLatencyTier(ms, config, mean));
}

export function latencyBlockFillClass(
  ms: number,
  _theme: "light" | "dark",
  config: LatencyColorConfig = DEFAULT_LATENCY_COLOR_CONFIG,
  mean: number | null = null,
): string {
  const tier = resolveLatencyTier(ms, config, mean);
  if (tier === "empty") return "bg-zen-fill-muted/55";
  if (tier === "green") return "bg-zen-success";
  if (tier === "yellow") return "bg-zen-warning";
  return "bg-zen-danger";
}

/** Map NodeTable text tier classes to segment fill colors. */
export function metricPercentFillClass(colorClass: string): string {
  if (colorClass.includes("text-zen-danger")) return "bg-zen-danger";
  if (colorClass.includes("text-zen-warning")) return "bg-zen-warning";
  if (colorClass.includes("text-zen-accent")) return "bg-zen-accent";
  return "bg-zen-fg-strong";
}

export function padLatencyHistory(
  samples: LatencySample[],
  len = LATENCY_HISTORY_LEN,
): LatencySample[] {
  if (samples.length >= len) return samples.slice(-len);
  const pad = Array.from({ length: len - samples.length }, () => ({
    ms: 0,
    t: 0,
  }));
  return [...pad, ...samples];
}

const MERGE_TIME_TOLERANCE_MS = 2000;

/** Merge API seed + live buffer; dedupe nearby timestamps, keep newest. */
export function mergeLatencyHistory(
  seed: LatencySample[],
  live: LatencySample[],
  len = LATENCY_HISTORY_LEN,
): LatencySample[] {
  const merged: LatencySample[] = [];

  const add = (sample: LatencySample) => {
    if (!Number.isFinite(sample.ms) || sample.ms <= 0 || !sample.t) return;

    const dupIdx = merged.findIndex(
      (s) => Math.abs(s.t - sample.t) <= MERGE_TIME_TOLERANCE_MS,
    );
    if (dupIdx >= 0) {
      if (sample.t >= merged[dupIdx].t) merged[dupIdx] = sample;
      return;
    }
    merged.push(sample);
  };

  for (const s of seed) add(s);
  for (const s of live) add(s);

  merged.sort((a, b) => a.t - b.t);
  return merged.slice(-len);
}

export function parseLatencyColorMode(raw: unknown): LatencyColorMode {
  return parseThemeSelectOption(raw, "Fixed") === "MeanDelta"
    ? "MeanDelta"
    : "Fixed";
}

export function parseThemeNumber(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function latencyColorConfigFromTheme(
  raw: Record<string, unknown>,
): LatencyColorConfig {
  return {
    mode: parseLatencyColorMode(raw.latencyColorMode),
    fixedGreenMax: parseThemeNumber(raw.latencyFixedGreenMax, 100),
    fixedYellowMax: parseThemeNumber(raw.latencyFixedYellowMax, 150),
    meanGreenDelta: parseThemeNumber(raw.latencyMeanGreenDelta, 10),
    meanYellowDelta: parseThemeNumber(raw.latencyMeanYellowDelta, 30),
  };
}
