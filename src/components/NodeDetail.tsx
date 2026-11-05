/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { sampleGpuRecords } from "@/lib/sampleGpuRecords";
import { liveGpuDeviceAt, resolveGpuReading } from "@/lib/liveGpu";
import { HistoryError } from "@/components/SectionErrorBoundary";
import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  Cpu,
  HardDrive,
  Info,
  Layers,
  List,
  MemoryStick,
  Wifi,
} from "lucide-react";
import { VPSNode } from "../types";
import { translations, Lang, type Messages } from "../lib/i18n";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
const LatencyProbePanel = React.lazy(() =>
  import("@/components/detail/LatencyProbePanel").then((m) => ({
    default: m.LatencyProbePanel,
  })),
);
import { DetailRangeChips } from "@/components/detail/DetailRangeChips";
import { useLoadRecords } from "@/hooks/useLoadRecords";
import { useNodeRecent } from "@/hooks/useNodeRecent";
import { useRecordSettings } from "@/hooks/useRecordSettings";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import {
  buildAllMetricHistories,
  formatLoadAverage,
  loadTotalsFromNode,
  normalizeLoadSeries,
} from "@/lib/recordTransform";
import {
  detailHistoryHours,
  formatChartOffsetLabel,
} from "@/lib/timeRangePresets";
import {
  formatBytesPerSec,
  formatKbps,
  formatPercent,
  formatTrafficGb,
  formatNodeTraffic,
  pickSpeedScale,
  scaleSpeedValue,
  formatSpeedAxisMax,
  formatStoragePair,
  formatUpdatedAt,
  formatUptime,
  type TrafficLimitType,
} from "@/lib/formatUnits";
import {
  formatPriceLine,
  formatRemainingValue,
  isExpiryUnset,
  resolveExpiryState,
  type BillingLabels,
} from "@/lib/billingDisplay";
import { OsIcon } from "@/components/OsIcon";
import { NodeTags } from "@/components/NodeTags";
import { parseNodeTags } from "@/lib/parseNodeTags";
import { useChartScrub } from "@/hooks/useChartScrub";
import { useLiveSeries } from "@/hooks/useLiveSeries";
import { useLiveData } from "@/contexts/LiveDataContext";
import { safePercent } from "@/lib/numeric";
import { zenType } from "@/lib/typography";
import { zenText } from "@/lib/zenSemantics";
import { zenMotion } from "@/lib/zenMotion";

interface NodeDetailProps {
  node: VPSNode;
  lang: Lang;
  theme: "light" | "dark";
  onBack?: () => void;
}

const isNum = (v: number | null): v is number =>
  v != null && Number.isFinite(v);

function getTrafficTypeFullLabel(
  type: TrafficLimitType | undefined,
  messages: Messages,
): string {
  switch (type ?? "sum") {
    case "max":
      return messages.trafficTypeMax;
    case "min":
      return messages.trafficTypeMin;
    case "up":
      return messages.trafficTypeOut;
    case "down":
      return messages.trafficTypeIn;
    case "sum":
    default:
      return messages.trafficTypeSum;
  }
}

const unlimitedTrafficBadgeClass =
  "border-zen-accent/35 bg-zen-accent/12 text-zen-accent";
const unlimitedTrafficSymbolClass =
  "inline-block scale-[1.45] leading-none tracking-normal";

function DetailSection({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`${zenMotion.detailSection} ${className}`.trim()}
      style={{ "--zen-stagger-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function SpecRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-[3px]">
      <span className="max-w-[46%] shrink-0 pt-px text-[13px] leading-5 text-zen-fg-muted">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words text-right text-[13px] font-medium leading-5 text-zen-fg-strong">
        {children}
      </span>
    </div>
  );
}

function LoadMeter({
  label,
  value,
  percent,
  color,
  hint,
  valueInline = false,
  track = "fill",
}: {
  label: string;
  value: React.ReactNode;
  percent?: number | null;
  color?: string;
  hint?: string;
  /** Keep the reading next to the label instead of the far edge. */
  valueInline?: boolean;
  /** fill draws a thin bar; none is text only. */
  track?: "fill" | "none";
}) {
  const width = Math.min(100, Math.max(0, percent ?? 0));
  return (
    <div className={track === "none" ? "" : "space-y-1.5"}>
      <div
        className={`flex items-baseline gap-2 ${
          valueInline ? "" : "justify-between"
        }`}
      >
        <span className="inline-flex min-w-0 items-center gap-1 text-[13px] text-zen-fg-muted">
          <span className="truncate">{label}</span>
          {hint ? (
            <span title={hint} className="inline-flex shrink-0">
              <Info
                className="h-3.5 w-3.5 text-zen-fg-faint"
                strokeWidth={1.75}
                aria-hidden
              />
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-zen-fg-strong">
          {value}
        </span>
      </div>
      {track === "none" ? null : (
        <div className="h-1 w-full overflow-hidden rounded-full bg-zen-fill-muted/35">
          {percent != null && color ? (
            <div
              className="h-full rounded-full"
              style={{ width: `${width}%`, backgroundColor: color }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function NetSpeedRow({
  dot,
  label,
  speed,
  totalLabel,
  total,
}: {
  dot: string;
  label: string;
  speed: string;
  totalLabel: string;
  total: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1.1fr)_auto_minmax(0,0.9fr)_auto] items-baseline gap-x-3 sm:gap-x-4">
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-zen-fg-muted">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-zen-fg-strong">
        {speed}
      </span>
      <span className="truncate text-[13px] text-zen-fg-muted">{totalLabel}</span>
      <span className="text-[13px] font-semibold tabular-nums text-zen-fg-strong">
        {total}
      </span>
    </div>
  );
}

function DetailLoading({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="flex items-center gap-2 rounded-full border border-zen-card-line bg-zen-card px-3 py-1.5 text-sm text-zen-chip-fg">
        <svg
          className="h-3.5 w-3.5 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>{label}</span>
      </div>
    </div>
  );
}

/** Brief entrance animation when async panel finishes loading. */
function useContentReveal(loading: boolean) {
  const wasLoading = React.useRef(loading);
  const [revealing, setRevealing] = React.useState(false);

  React.useEffect(() => {
    if (wasLoading.current && !loading) {
      setRevealing(true);
      const timer = window.setTimeout(() => setRevealing(false), 520);
      wasLoading.current = loading;
      return () => clearTimeout(timer);
    }
    wasLoading.current = loading;
    if (loading) setRevealing(false);
  }, [loading]);

  return revealing;
}

function contentPanelMotion(busy: boolean, revealing: boolean) {
  const base = "transition-opacity duration-300 ease-out";
  if (busy) {
    return `${base} opacity-40 pointer-events-none select-none`;
  }
  if (revealing) {
    return `${base} ${zenMotion.contentReveal}`;
  }
  return `${base} opacity-100`;
}

type ChartPt = { x: number; y: number; val: number };

type ChartExtraSeries = {
  data: (number | null)[];
  color: string;
  label: string;
  formatValue?: (chartValue: number) => string;
  strokeWidth?: number;
  strokeDasharray?: string;
};

/** Build an SVG line path, connecting across null gaps. */
function buildLinePath(pts: (ChartPt | null)[]): string {
  let d = "";
  let started = false;
  for (const p of pts) {
    if (!p) continue;
    d += started ? ` L ${p.x} ${p.y}` : `M ${p.x} ${p.y}`;
    started = true;
  }
  return d.trim();
}

/** Build the area fill under each contiguous (gap-free) run of points. */
function buildAreaPath(pts: (ChartPt | null)[], baseY: number): string {
  let d = "";
  let run: ChartPt[] = [];
  const flush = () => {
    if (run.length === 0) return;
    d += ` M ${run[0].x} ${baseY}`;
    for (const p of run) d += ` L ${p.x} ${p.y}`;
    d += ` L ${run[run.length - 1].x} ${baseY} Z`;
    run = [];
  };
  for (const p of pts) {
    if (!p) flush();
    else run.push(p);
  }
  flush();
  return d.trim();
}

function lastValidIndex(arr: (number | null)[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (isNum(arr[i])) return i;
  }
  return -1;
}

const ZEN_CHART = {
  cpu: "var(--zen-series-cpu)",
  mem: "var(--zen-series-mem)",
  swap: "var(--zen-series-swap)",
  load: "var(--zen-series-disk)",
  disk: "var(--zen-series-disk)",
  netIn: "var(--zen-series-net-in)",
  netOut: "var(--zen-series-net-out)",
  tcp: "var(--zen-series-tcp)",
  udp: "var(--zen-series-udp)",
  proc: "var(--zen-series-proc)",
} as const;

function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

const detailCardClass =
  "rounded-2xl border border-zen-card-line bg-zen-card px-4 py-3.5 sm:px-5 sm:py-4";
const chartCardClass =
  "rounded-2xl border border-zen-card-line bg-zen-card px-3.5 py-3 sm:px-4 sm:py-3.5";
const detailTitleClass =
  "text-sm font-semibold leading-none text-zen-fg-strong";

const MiniLineChart = ({
  data,
  data2,
  color = ZEN_CHART.cpu,
  color2 = ZEN_CHART.swap,
  maxVal = 100,
  unit = "%",
  unitMode = "percent",
  title,
  subMetrics,
  theme,
  label1 = "VALUE",
  label2,
  timeRange = 24,
  messages,
  decimals,
  hasData = true,
  valueFormatter,
  timestamps,
  extraSeries,
  icon: Icon,
}: {
  key?: React.Key;
  data: (number | null)[];
  data2?: (number | null)[];
  color?: string;
  color2?: string;
  maxVal?: number;
  unit?: string;
  unitMode?: "percent" | "speed" | "count";
  title: string;
  subMetrics?: React.ReactNode;
  theme: "light" | "dark";
  label1?: string;
  label2?: string;
  timeRange?: number;
  messages: Messages;
  decimals?: boolean;
  hasData?: boolean;
  valueFormatter?: (value: number) => string;
  timestamps?: number[];
  extraSeries?: ChartExtraSeries[];
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const rawMax = React.useMemo(
    () =>
      [data, data2 ?? [], ...(extraSeries?.map((s) => s.data) ?? [])].reduce(
        (max, series) =>
          series.reduce(
            (value, point) => (isNum(point) ? Math.max(value, point) : value),
            max,
          ),
        Math.max(maxVal, 0.001),
      ),
    [maxVal, data, data2, extraSeries],
  );
  const speedScale = React.useMemo(
    () => (unitMode === "speed" ? pickSpeedScale(rawMax) : null),
    [rawMax, unitMode],
  );
  const chartData = React.useMemo(
    () =>
      unitMode === "speed" && speedScale
        ? data.map((v) => (v == null ? null : scaleSpeedValue(v, speedScale)))
        : data,
    [data, speedScale, unitMode],
  );
  const chartData2 = React.useMemo(
    () =>
      data2 && unitMode === "speed" && speedScale
        ? data2.map((v) => (v == null ? null : scaleSpeedValue(v, speedScale)))
        : data2,
    [data2, speedScale, unitMode],
  );
  const chartMax =
    unitMode === "speed" && speedScale
      ? scaleSpeedValue(rawMax, speedScale) * 1.12
      : unitMode === "count"
        ? niceCeil(rawMax)
        : rawMax;

  const axisLabels = React.useMemo(() => {
    if (unitMode === "speed") {
      const topBytes = rawMax * 1.12;
      return [
        formatSpeedAxisMax(topBytes).replace(/\/S\b/g, "/s"),
        formatSpeedAxisMax(topBytes / 2).replace(/\/S\b/g, "/s"),
        "0",
      ];
    }
    if (unitMode === "percent") {
      const top = chartMax;
      return [`${top.toFixed(0)}${unit}`, `${(top / 2).toFixed(0)}${unit}`, `0${unit}`];
    }
    const top = chartMax;
    const fmt = (value: number) =>
      value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
    return [fmt(top), fmt(top / 2), "0"];
  }, [chartMax, rawMax, unit, unitMode]);

  const formatDisplay = (v: number | null) => {
    if (v == null || !Number.isFinite(v)) return "—";
    if (valueFormatter) return valueFormatter(v);
    if (unitMode === "speed") return formatBytesPerSec(v).replace(/\/S\b/g, "/s");
    if (unitMode === "percent") return formatPercent(v);
    return String(Math.round(v));
  };

  const width = 500;
  const height = 120;
  const paddingX = 2;
  const paddingY = 4;
  const chartWidth = width - paddingX * 2; // 468
  const chartHeight = height - paddingY * 2; // 90
  const maxValSafe = chartMax <= 0 ? 1 : chartMax;

  const denominator = Math.max(1, chartData.length - 1);

  const scrubConfig = React.useMemo(
    () => ({
      width,
      paddingX,
      chartWidth,
      dataLength: chartData.length,
      timestamps,
    }),
    [chartData.length, chartWidth, timestamps],
  );

  const {
    hoveredIndex,
    onMouseMove,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  } = useChartScrub(containerRef, scrubConfig);

  const baseY = height - paddingY;
  const chartGeometry = React.useMemo(() => {
    const pointX = (index: number, count: number) => {
      if (
        timestamps?.length === count &&
        count > 1 &&
        timestamps[count - 1] > timestamps[0]
      ) {
        return (
          paddingX +
          ((timestamps[index] - timestamps[0]) /
            (timestamps[count - 1] - timestamps[0])) *
            chartWidth
        );
      }
      return paddingX + (index / Math.max(1, count - 1)) * chartWidth;
    };
    const toPoint = (val: number | null, x: number): ChartPt | null => {
      if (val == null) return null;
      const y =
        baseY -
        (Math.max(0, Math.min(maxValSafe, val)) / maxValSafe) * chartHeight;
      return { x, y, val };
    };

    const points1 = chartData.map((val, i) =>
      toPoint(val, pointX(i, chartData.length)),
    );

    const denominator2 = chartData2 ? Math.max(1, chartData2.length - 1) : 1;
    const points2 = chartData2
      ? chartData2.map((val, i) => toPoint(val, pointX(i, chartData2.length)))
      : null;

    const extraLayers = (extraSeries ?? []).map((series) => {
      const denominatorExtra = Math.max(1, series.data.length - 1);
      const points = series.data.map((val, i) =>
        toPoint(val, pointX(i, series.data.length)),
      );
      return { ...series, points };
    });

    return {
      points1,
      points2,
      extraLayers,
      pathD: buildLinePath(points1),
      areaD: buildAreaPath(points1, baseY),
      pathD2: points2 ? buildLinePath(points2) : "",
      areaD2: points2 ? buildAreaPath(points2, baseY) : "",
    };
  }, [
    baseY,
    chartData,
    chartData2,
    chartHeight,
    chartWidth,
    denominator,
    extraSeries,
    maxValSafe,
    timestamps,
  ]);
  const { points1, points2, extraLayers, pathD, areaD, pathD2, areaD2 } =
    chartGeometry;

  const gridLines = React.useMemo(() => [0, 0.5, 1], []);

  const strokeColor =
    theme === "dark" ? "rgba(250, 249, 245, 0.08)" : "rgba(48, 48, 46, 0.08)";

  const isHovering = hoveredIndex !== null;
  const lastIdx1 = lastValidIndex(chartData);
  const activeIdx =
    hoveredIndex !== null
      ? hoveredIndex
      : lastIdx1 >= 0
        ? lastIdx1
        : chartData.length - 1;

  const displayVal1 = data[activeIdx] ?? null;
  const displayVal2 = data2 ? (data2[activeIdx] ?? null) : null;

  const hoverTs = timestamps?.[activeIdx];
  const hoverLabel =
    hoverTs != null
      ? (() => {
          const d = new Date(hoverTs);
          const p = (n: number) => String(n).padStart(2, "0");
          return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
        })()
      : formatChartOffsetLabel(
          chartData.length - 1 - activeIdx,
          timeRange,
          chartData.length,
          messages,
        );

  const fallbackX =
    timestamps?.length === chartData.length &&
    timestamps.at(-1)! > timestamps[0]
      ? paddingX +
        ((timestamps[activeIdx] - timestamps[0]) /
          (timestamps.at(-1)! - timestamps[0])) *
          chartWidth
      : paddingX + (activeIdx / denominator) * chartWidth;
  const activeX = points1[activeIdx]?.x ?? fallbackX;
  const activeY1 = points1[activeIdx]?.y ?? baseY;
  const activeY2 =
    points2 && points2[activeIdx] ? points2[activeIdx]!.y : baseY;
  const activeExtraYs = extraLayers.map(
    (layer) => layer.points[activeIdx]?.y ?? baseY,
  );
  const minY = Math.min(
    activeY1,
    points2 && points2[activeIdx] ? activeY2 : activeY1,
    ...(activeExtraYs.length ? activeExtraYs : [activeY1]),
  );

  const safeId = title.replace(/[^a-zA-Z0-9]/g, "_");

  const secondMuted =
    displayVal2 != null && Number.isFinite(displayVal2) && displayVal2 === 0;

  return (
    <div className="km-load-chart group flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3 select-none">
        <span className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <Icon
              className="h-4 w-4 shrink-0 text-zen-fg-muted"
              strokeWidth={1.75}
            />
          ) : null}
          <span className="truncate text-sm font-medium text-zen-fg-strong">
            {title}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5 text-sm font-semibold tabular-nums">
          {isHovering ? (
            <span className="text-xs font-medium text-zen-fg-muted">
              {hoverLabel}
            </span>
          ) : null}
          <span style={{ color }}>{formatDisplay(displayVal1)}</span>
          {displayVal2 !== null ? (
            <span
              style={secondMuted ? undefined : { color: color2 }}
              className={secondMuted ? "text-zen-fg-faint" : undefined}
            >
              {formatDisplay(displayVal2)}
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex items-stretch gap-1.5">
        <div className="flex w-14 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] leading-none tabular-nums text-zen-fg-faint">
          {axisLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
        {!hasData ? (
          <div className="flex h-24 flex-1 items-center justify-center text-sm text-zen-fg-muted">
            {messages.noHistory}
          </div>
        ) : (
          <div
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="relative min-w-0 flex-1 cursor-crosshair touch-pan-y"
          >
            <svg
              data-chart-main
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              className="pointer-events-none h-24 w-full overflow-visible"
            >
              <defs>
                <linearGradient
                  id={`grad-${safeId}-1`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
                {data2 && (
                  <linearGradient
                    id={`grad-${safeId}-2`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color2} stopOpacity="0.16" />
                    <stop offset="100%" stopColor={color2} stopOpacity="0.0" />
                  </linearGradient>
                )}
              </defs>

              {gridLines.map((ratio, index) => {
                const h = height - paddingY - ratio * chartHeight;
                return (
                  <line
                    key={index}
                    x1="0"
                    y1={h}
                    x2={width}
                    y2={h}
                    stroke={strokeColor}
                    strokeWidth="1"
                  />
                );
              })}

              {/* Extra overlay lines (e.g. system load) */}
              {extraLayers.map((layer, layerIdx) => {
                const path = buildLinePath(layer.points);
                if (!path) return null;
                return (
                  <path
                    key={`${safeId}-extra-${layerIdx}`}
                    d={path}
                    stroke={layer.color}
                    strokeWidth={layer.strokeWidth ?? 1}
                    {...(layer.strokeDasharray
                      ? { strokeDasharray: layer.strokeDasharray }
                      : {})}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    className="opacity-85"
                  />
                );
              })}

              {/* Area 2 */}
              {areaD2 && <path d={areaD2} fill={`url(#grad-${safeId}-2)`} />}
              {/* Line 2 */}
              {pathD2 && (
                <path
                  d={pathD2}
                  stroke={color2}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}

              {/* Area 1 */}
              {areaD && <path d={areaD} fill={`url(#grad-${safeId}-1)`} />}
              {/* Line 1 */}
              {pathD && (
                <path
                  d={pathD}
                  stroke={color}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}

              {/* Vertical tracker crosshair line on hover */}
              {isHovering && (
                <line
                  x1={activeX}
                  y1={paddingY}
                  x2={activeX}
                  y2={height - paddingY}
                  stroke={
                    theme === "dark"
                      ? "rgba(255, 255, 255, 0.4)"
                      : "rgba(0, 0, 0, 0.45)"
                  }
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
              )}
            </svg>

            {/* Hover point markers only — HTML overlay so they stay perfectly round
            despite the non-uniform SVG stretch (preserveAspectRatio="none"). */}
            {isHovering && points1[activeIdx] && (
              <span
                className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${(activeX / width) * 100}%`,
                  top: `${(activeY1 / height) * 100}%`,
                  width: 9,
                  height: 9,
                  backgroundColor: color,
                }}
              />
            )}
            {isHovering && points2?.[activeIdx] && (
              <span
                className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${(activeX / width) * 100}%`,
                  top: `${(activeY2 / height) * 100}%`,
                  width: 9,
                  height: 9,
                  backgroundColor: color2,
                }}
              />
            )}

            {isHovering && (
              <div
                className={`absolute z-10 pointer-events-none px-2 py-1.5 rounded shadow-lg border ${zenType.caption} font-mono flex flex-col gap-0.5 select-none max-w-[min(280px,calc(100vw-2rem))] ${
                  theme === "dark"
                    ? "bg-zen-surface border-zen-border-muted text-zen-fg-strong"
                    : "bg-zen-surface border-zen-border text-zen-fg-strong"
                }`}
                style={{
                  left: `${(activeX / width) * 100}%`,
                  top: `${(minY / height) * 100}%`,
                  transform:
                    activeX / width > 0.55
                      ? "translate(-102%, -125%)"
                      : "translate(8%, -125%)",
                }}
              >
                <div className="flex items-center gap-4 whitespace-nowrap justify-between">
                  <span className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ backgroundColor: color }}
                    ></span>
                    <span>{label1}:</span>
                  </span>
                  <span className="font-bold text-zen-fg-strong">
                    {formatDisplay(displayVal1)}
                  </span>
                </div>
                {displayVal2 !== null && (
                  <div className="flex items-center gap-4 whitespace-nowrap justify-between">
                    <span className="flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{ backgroundColor: color2 }}
                      ></span>
                      <span>{label2 || "VALUE 2"}:</span>
                    </span>
                    <span className="font-bold text-zen-fg-strong">
                      {formatDisplay(displayVal2)}
                    </span>
                  </div>
                )}
                {extraLayers.map((layer, layerIdx) => {
                  const raw = layer.data[activeIdx];
                  if (raw == null || !Number.isFinite(raw)) return null;
                  const shown = layer.formatValue
                    ? layer.formatValue(raw)
                    : formatDisplay(raw);
                  return (
                    <div
                      key={`${safeId}-tip-${layerIdx}`}
                      className="flex items-center gap-4 whitespace-nowrap justify-between"
                    >
                      <span className="flex items-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ backgroundColor: layer.color }}
                        />
                        <span>{layer.label}:</span>
                      </span>
                      <span className="font-bold text-zen-fg-strong">
                        {shown}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {subMetrics && <div className="pt-1.5">{subMetrics}</div>}
    </div>
  );
};

export function NodeDetail({ node, lang, theme, onBack }: NodeDetailProps) {
  const t = translations[lang];
  const { recordEnabled, loadMaxHours, pingMaxHours, loadPresets, pingPresets } =
    useRecordSettings();
  const { status: liveDataStatus } = useLiveData();
  const { pingTaskIds } = useThemeSettings();
  const loadHistoryHours = React.useMemo(
    () => detailHistoryHours(loadMaxHours, loadPresets),
    [loadMaxHours, loadPresets],
  );
  const pingHistoryHours = React.useMemo(
    () => detailHistoryHours(pingMaxHours, pingPresets),
    [pingMaxHours, pingPresets],
  );

  const [selectedLoadHours, setSelectedLoadHours] = React.useState(6);
  const [selectedPingHours, setSelectedPingHours] = React.useState(6);
  const [isPingLoading, setIsPingLoading] = React.useState(false);
  const [liveMode, setLiveMode] = React.useState(true);
  const [pingLive, setPingLive] = React.useState(false);
  const [selectedProbes, setSelectedProbes] = React.useState<string[]>([]);

  const liveSamples = useLiveSeries(
    node,
    node.status === "online" && liveDataStatus === "fresh" && liveMode,
  );

  React.useEffect(() => {
    if (loadHistoryHours.length === 0) return;
    if (!loadHistoryHours.includes(selectedLoadHours)) {
      setSelectedLoadHours(
        loadHistoryHours.includes(6) ? 6 : loadHistoryHours[0],
      );
    }
  }, [loadHistoryHours, selectedLoadHours]);

  React.useEffect(() => {
    if (pingHistoryHours.length === 0) return;
    if (!pingHistoryHours.includes(selectedPingHours)) {
      setSelectedPingHours(
        pingHistoryHours.includes(6) ? 6 : pingHistoryHours[0],
      );
    }
  }, [pingHistoryHours, selectedPingHours]);

  const loadHours =
    recordEnabled && node.online && !liveMode ? selectedLoadHours : 0;
  const {
    records: loadRecords,
    gpuDevices,
    isLoading: isLoadLoading,
    error: loadError,
    retry: retryLoad,
    hasLoaded: hasLoadResult,
  } = useLoadRecords(node.id, loadHours);
  const { records: recentRecords } = useNodeRecent(
    node.id,
    loadHours > 0 &&
      loadHours <= 24 &&
      hasLoadResult &&
      !isLoadLoading &&
      loadRecords.length === 0,
  );

  const handleToggleProbe = (id: string) => {
    if (id === "CLEAR_ALL") {
      setSelectedProbes([]);
      return;
    }
    setSelectedProbes((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleLoadRangeChange = (newHours: number) => {
    if (newHours === selectedLoadHours || isLoadLoading) return;
    setSelectedLoadHours(newHours);
  };

  const handlePingRangeChange = (newHours: number) => {
    if (newHours === selectedPingHours || isPingLoading) return;
    setSelectedPingHours(newHours);
  };

  const pingHours = pingLive
    ? Math.max(1, Math.min(1, pingMaxHours || 1))
    : selectedPingHours;

  // Helper to format speeds (node fields are KB/s)
  const formatSpeed = (kbps: number) =>
    formatKbps(kbps).replace(/\/S\b/g, "/s");


  const memPercent = node.online
    ? safePercent(node.memoryUsed, node.memoryTotal)
    : 0;
  const diskPercent = node.online
    ? safePercent(node.diskUsed, node.diskTotal)
    : 0;

  // Design accent variables
  const textPrimary = zenText.primary;

  const loadTotals = React.useMemo(
    () => loadTotalsFromNode(node),
    [node.memoryTotal, node.swapTotal, node.diskTotal],
  );

  const metricHistory = React.useMemo(() => {
    const histories = buildAllMetricHistories(
      selectedLoadHours,
      loadTotals,
      loadRecords,
      recentRecords,
    );
    return {
      cpu: histories.cpu,
      load: histories.load1,
      mem: histories.mem,
      swap: histories.swap,
      disk: histories.disk,
      netIn: histories.netin,
      netOut: histories.netout,
      tcp: histories.tcp,
      udp: histories.udp,
      proc: histories.processes,
      temp: histories.temp,
    };
  }, [selectedLoadHours, loadTotals, loadRecords, recentRecords]);

  const cpuHist = metricHistory.cpu;
  const loadHist = metricHistory.load;
  const memHist = metricHistory.mem;
  const swapHist = metricHistory.swap;
  const diskHist = metricHistory.disk;
  const netInHist = metricHistory.netIn;
  const netOutHist = metricHistory.netOut;
  const tcpHist = metricHistory.tcp;
  const udpHist = metricHistory.udp;
  const procHist = metricHistory.proc;
  const tempHist = metricHistory.temp;

  const displayedCpuHistory = cpuHist.values;
  const displayedMemHistory = memHist.values;
  const displayedSwapHistory = swapHist.values;
  const displayedDiskHistory = diskHist.values;
  const displayedNetInHistory = netInHist.values;
  const displayedNetOutHistory = netOutHist.values;
  const displayedTcpHistory = tcpHist.values;
  const displayedUdpHistory = udpHist.values;
  const displayedProcessesHistory = procHist.values;
  const displayedTemperatureHistory = tempHist.values;
  const currentTemperature =
    [...displayedTemperatureHistory].reverse().find(isNum) ?? 0;

  const gpuCharts = React.useMemo(
    () =>
      gpuDevices.map((device) => {
        const records = sampleGpuRecords(device.records);
        return {
          ...device,
          utilization: records.map((record) => record.utilization),
          memory: records.map((record) =>
            record.mem_used != null && record.mem_total > 0
              ? (record.mem_used / record.mem_total) * 100
              : null,
          ),
          timestamps: records.map((record) => new Date(record.time).getTime()),
          reading: resolveGpuReading(
            liveGpuDeviceAt(node.gpuLive, device.device_index),
            records[records.length - 1],
          ),
        };
      }),
    [gpuDevices, node.gpuLive],
  );

  const numOnly = (a: (number | null)[]): number[] => a.filter(isNum);
  const netRawMax = Math.max(
    ...numOnly(displayedNetInHistory),
    ...numOnly(displayedNetOutHistory),
    node.netSpeedIn * 1024,
    node.netSpeedOut * 1024,
    1,
  );

  // Live (real-time) series — a rolling window appended every ~2s.
  const live = React.useMemo(
    () => ({
      cpu: liveSamples.map((s) => s.cpu),
      mem: liveSamples.map((s) => s.mem),
      swap: liveSamples.map((s) => s.swap),
      disk: liveSamples.map((s) => s.disk),
      netIn: liveSamples.map((s) => s.netIn),
      netOut: liveSamples.map((s) => s.netOut),
      tcp: liveSamples.map((s) => s.tcp),
      udp: liveSamples.map((s) => s.udp),
      proc: liveSamples.map((s) => s.proc),
      load: liveSamples.map((s) => s.load1),
      timestamps: liveSamples.map((s) => s.t),
    }),
    [liveSamples],
  );
  const liveHasData = liveSamples.length > 0;
  const metricsReveal = useContentReveal(!liveMode && isLoadLoading);
  const pingReveal = useContentReveal(isPingLoading);
  const liveReveal = useContentReveal(liveMode && !liveHasData);
  const metricsPanelClass = contentPanelMotion(
    !liveMode && isLoadLoading,
    metricsReveal,
  );
  const pingPanelClass = contentPanelMotion(isPingLoading, pingReveal);
  const livePanelClass =
    liveMode && !liveHasData
      ? "transition-opacity duration-500 ease-out opacity-35"
      : liveReveal
        ? `${zenMotion.contentReveal} transition-opacity duration-500 ease-out opacity-100`
        : "transition-opacity duration-500 ease-out opacity-100";
  // Approximate window span in hours for the hover "time ago" label.
  const liveTimeRange = (Math.max(1, liveSamples.length) * 2) / 3600;
  const pick = <T,>(liveVal: T, histVal: T): T =>
    liveMode ? liveVal : histVal;

  // Absolute timestamp (epoch ms) per chart point, for the hover label.
  const liveTimestamps = live.timestamps;
  const histTimestamps = cpuHist.timestamps;
  const chartTimestamps = pick(liveTimestamps, histTimestamps);

  const cpuCores = Math.max(1, node.cpuCores);
  const formatLoadChartValue = React.useCallback(
    (chartVal: number) => formatLoadAverage((chartVal / 100) * cpuCores),
    [cpuCores],
  );
  const normLoadSeries = (liveVals: number[], histVals: (number | null)[]) =>
    normalizeLoadSeries(pick(liveVals, histVals), cpuCores);

  const cpuLoadExtraSeries: ChartExtraSeries[] = React.useMemo(
    () => [
      {
        data: normLoadSeries(live.load, loadHist.values),
        color: ZEN_CHART.load,
        label: t.lblLoad1m,
        formatValue: formatLoadChartValue,
        strokeDasharray: "5 3",
        strokeWidth: 1.4,
      },
    ],
    [live.load, loadHist.values, t.lblLoad1m, formatLoadChartValue],
  );

  const hasTags = parseNodeTags(node.tags).length > 0;
  const publicRemarkText = node.publicRemark.trim();
  const privateRemarkText = node.privateRemark.trim();
  const hasPublicRemark = publicRemarkText.length > 0;
  const hasPrivateRemark = privateRemarkText.length > 0;
  const showNodeMeta = hasPublicRemark || hasPrivateRemark;
  const groupName = node.nodeGroup.trim();
  const groupHref = groupName ? `/?group=${encodeURIComponent(groupName)}` : "";
  const hasClientVersion = node.clientVersion.trim().length > 0;
  const hasExpiry = !isExpiryUnset(node.expiredAt);
  const hasRenewalPrice = node.price !== 0;
  const expiryState = hasExpiry ? resolveExpiryState(node.expiredAt) : null;
  const billingLabels: BillingLabels = {
    unitDays: t.unitDays,
    billingFree: t.billingFree,
    billingExpired: t.billingExpired,
    billingLongTerm: t.billingLongTerm,
    billingNoInfo: t.billingNoInfo,
    billingHidden: t.billingHidden,
    billingNotSet: t.billingNotSet,
    billingMonthly: t.billingMonthly,
    billingQuarterly: t.billingQuarterly,
    billingSemiAnnual: t.billingSemiAnnual,
    billingAnnual: t.billingAnnual,
    billingBiennial: t.billingBiennial,
    billingTriennial: t.billingTriennial,
    billingQuinquennial: t.billingQuinquennial,
    billingOnce: t.billingOnce,
    billingCycleDays: t.billingCycleDays,
  };
  const remainingValueLabel = formatRemainingValue(
    {
      price: node.price,
      currency: node.currency,
      billingCycle: node.billingCycle,
      expiredAt: node.expiredAt,
    },
    billingLabels,
  );
  const hasRemainingValue = remainingValueLabel !== null && node.price > 0;
  const hasHeaderMeta = groupName.length > 0 || hasTags;
  const showSepAfterGroup = groupName && hasTags;
  const expiryLabel = (() => {
    if (!hasExpiry || !expiryState) return t.billingNoInfo;
    if (expiryState.kind === "long_term") return t.billingLongTerm;
    if (expiryState.kind === "expired") return t.billingExpired;
    return formatUpdatedAt(node.expiredAt);
  })();
  const renewalPriceLabel = hasRenewalPrice
    ? (formatPriceLine(
        node.price,
        node.currency,
        node.billingCycle,
        billingLabels,
      ) ?? t.billingNoInfo)
    : null;
  const expiryValueClass =
    expiryState?.kind === "expired" ||
    (expiryState?.kind === "active" && expiryState.daysRemaining <= 7)
      ? "text-zen-danger font-semibold"
      : textPrimary;
  const statusOnline = node.status === "online";
  const statusOffline = node.status === "offline";
  const statusText = (
    statusOnline
      ? t.hostOnline
      : statusOffline
        ? t.connectionOffline
        : t.statusUnknown
  ).replace(/^[●▲]\s*/, "");
  const emptySpec = t.lblNone;
  const specText = (value: string | number | null | undefined) => {
    const text = value == null ? "" : String(value).trim();
    return text || emptySpec;
  };
  const uptimeText =
    node.online && node.uptimeSec > 0
      ? formatUptime(node.uptimeSec, {
          day: t.unitDay,
          hour: t.unitHour,
          minute: t.unitMin,
          second: t.unitSec,
        })
      : "—";
  const bootText =
    node.online && node.uptimeSec > 0
      ? formatUpdatedAt(Date.now() - node.uptimeSec * 1000)
      : "—";
  const priceText =
    renewalPriceLabel == null
      ? null
      : hasRemainingValue
        ? `${renewalPriceLabel} | ${remainingValueLabel} ${t.billingRemainingValueShort}`
        : renewalPriceLabel;
  const networkHeading = t.lblNetworkSpeedRxTx
    .replace(/\s*RX\/TX\s*/i, "")
    .trim();

  const hardwareCard = (
    <section className={`${detailCardClass} h-full`}>
      <div className="mb-2.5 flex items-center gap-2">
        <Cpu className="h-4 w-4 text-zen-fg-muted" strokeWidth={1.75} />
        <h3 className={detailTitleClass}>{t.hardwareSpec}</h3>
      </div>
      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2 lg:items-start">
        <div>
          <SpecRow label={t.lblCpuVendor}>{specText(node.cpuVendor)}</SpecRow>
          <SpecRow label={t.lblCpuCores}>
            {node.cpuCores} {t.lblCpuThreads}
          </SpecRow>
          <SpecRow label={t.lblArch}>{specText(node.arch)}</SpecRow>
          <SpecRow label={t.lblSystemOs}>
            <span className="inline-flex max-w-full items-center justify-end gap-1.5">
              <OsIcon os={node.os} />
              <span className="min-w-0 break-words text-left">
                {specText(node.os)}
              </span>
            </span>
          </SpecRow>
          <SpecRow label={t.lblKernel}>{specText(node.kernelVersion)}</SpecRow>
          <SpecRow label={t.lblVirtualization}>
            {specText(node.virtualization)}
          </SpecRow>
          <SpecRow label={t.lblGpu}>{specText(node.gpuName)}</SpecRow>
          <SpecRow label={t.lblUptimeSec}>{uptimeText}</SpecRow>
        </div>
        <div className="mt-2 border-t border-zen-card-line pt-2 lg:mt-0 lg:border-t-0 lg:pt-0">
          <SpecRow label={t.lblKomariVersion}>
            {hasClientVersion ? node.clientVersion.trim() : "—"}
          </SpecRow>
          <SpecRow label={t.lblBootTime}>{bootText}</SpecRow>
          <SpecRow label={t.lblLastUpdated}>
            {formatUpdatedAt(node.updatedAt)}
          </SpecRow>
          {hasExpiry ? (
            <SpecRow label={t.lblExpiredAt}>
              <span className={expiryValueClass}>{expiryLabel}</span>
            </SpecRow>
          ) : null}
          {priceText ? (
            <SpecRow label={t.lblRenewalPrice}>{priceText}</SpecRow>
          ) : null}
        </div>
      </div>
    </section>
  );

  const chartTimeRange = pick(liveTimeRange, selectedLoadHours);
  const chartHas = (liveOk: boolean, histOk: boolean) => pick(liveOk, histOk);

  return (
    <div className="km-instance-detail space-y-4 pb-2 font-sans text-sm">
      <DetailSection delay={0}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={t.backToList}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zen-fg-muted hover:bg-zen-elevate hover:text-zen-fg-strong"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : null}
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              statusOnline
                ? "bg-zen-online"
                : statusOffline
                  ? "bg-zen-danger"
                  : "bg-zen-fg-faint"
            }`}
            aria-hidden
          />
          <h2 className="min-w-0 text-lg font-semibold tracking-tight text-zen-fg-strong break-words sm:text-xl">
            {node.name}
          </h2>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              statusOnline
                ? "bg-zen-online-bg text-zen-online"
                : "bg-zen-fill-muted/35 text-zen-fg-muted"
            }`}
          >
            {statusText}
          </span>
          {hasHeaderMeta ? (
            <div className="ml-auto flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zen-fg-muted">
              {groupName ? (
                <Link
                  to={groupHref}
                  className="shrink-0 font-medium hover:text-zen-accent"
                >
                  {groupName}
                </Link>
              ) : null}
              {showSepAfterGroup ? (
                <span className="text-zen-fg-faint" aria-hidden>
                  /
                </span>
              ) : null}
              {hasTags ? (
                <NodeTags
                  tags={node.tags}
                  theme={theme}
                  size="header"
                  maxVisible={99}
                  spaced
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </DetailSection>

      {showNodeMeta ? (
        <DetailSection delay={40} className="space-y-2">
          {hasPublicRemark ? (
            <p className="whitespace-pre-wrap break-words text-zen-fg">
              <span className="mb-0.5 block text-xs text-zen-fg-muted">
                {t.publicRemark}
              </span>
              {publicRemarkText}
            </p>
          ) : null}
          {hasPrivateRemark ? (
            <p className="whitespace-pre-wrap break-words text-zen-fg">
              <span className="mb-0.5 block text-xs text-zen-fg-muted">
                {t.privateRemark}
              </span>
              {privateRemarkText}
            </p>
          ) : null}
        </DetailSection>
      ) : null}

      {node.online ? (
        <>
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <DetailSection delay={60} className="h-full">
              {hardwareCard}
            </DetailSection>
            <DetailSection delay={90} className="h-full">
              <section className={`${detailCardClass} h-full`}>
                <div className="mb-3 flex items-center gap-2">
                  <Activity
                    className="h-4 w-4 text-zen-fg-muted"
                    strokeWidth={1.75}
                  />
                  <h3 className={detailTitleClass}>{t.capacityLoads}</h3>
                </div>
                <div className="flex flex-col gap-3.5">
                  <LoadMeter
                    label={t.lblCpuLoadUtil}
                    value={formatPercent(node.cpuUsage)}
                    percent={node.cpuUsage}
                    color="var(--zen-series-cpu)"
                  />
                  <LoadMeter
                    label={t.lblLoadAvg}
                    value={node.loadAvg || "—"}
                    hint={t.loadAvgHint}
                    valueInline
                    track="none"
                  />
                  <LoadMeter
                    label={t.lblMemoryAllocated}
                    value={`${formatStoragePair(node.memoryUsed, node.memoryTotal)} · ${formatPercent(memPercent)}`}
                    percent={memPercent}
                    color="var(--zen-series-mem)"
                  />
                  <LoadMeter
                    label="SWAP"
                    value={formatStoragePair(node.swapUsed, node.swapTotal)}
                    track="none"
                  />
                  <LoadMeter
                    label={t.lblDisk}
                    value={`${formatStoragePair(node.diskUsed, node.diskTotal)} · ${formatPercent(diskPercent)}`}
                    percent={diskPercent}
                    color="var(--zen-series-disk)"
                  />
                  <div>
                    <div className="mb-2 flex items-baseline gap-2 text-[13px] text-zen-fg-muted">
                      <span>{networkHeading}</span>
                      <span className="text-xs font-medium tracking-wide text-zen-fg-subtle">
                        RX/TX
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <NetSpeedRow
                          dot="var(--zen-series-net-in)"
                          label={t.lblInboundRxShort}
                          speed={formatSpeed(node.netSpeedIn)}
                          totalLabel={t.lblDownloaded}
                          total={formatTrafficGb(node.bandwidthUsedIn)}
                        />
                        <NetSpeedRow
                          dot="var(--zen-series-net-out)"
                          label={t.lblOutboundTxShort}
                          speed={formatSpeed(node.netSpeedOut)}
                          totalLabel={t.lblUploaded}
                          total={formatTrafficGb(node.bandwidthUsedOut)}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 border-zen-card-line text-[13px] tabular-nums min-[520px]:self-stretch min-[520px]:border-l min-[520px]:pl-4">
                        {node.bandwidthTotal <= 0 ? (
                          <span
                            className={`inline-flex shrink-0 rounded-sm border px-1 py-px text-[10px] font-bold leading-none ${unlimitedTrafficBadgeClass}`}
                          >
                            <span className={unlimitedTrafficSymbolClass}>
                              ∞
                            </span>
                          </span>
                        ) : (
                          <span className="text-zen-fg-muted">
                            {getTrafficTypeFullLabel(node.trafficLimitType, t)}
                          </span>
                        )}
                        <span className="font-semibold text-zen-fg-strong">
                          {formatNodeTraffic(node)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </DetailSection>
          </div>

          <DetailSection delay={120} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <Activity
                  className="h-4 w-4 text-zen-fg-muted"
                  strokeWidth={1.75}
                />
                <h3 className={detailTitleClass}>{t.tabMetrics}</h3>
              </div>
              <DetailRangeChips
                hours={recordEnabled ? loadHistoryHours : []}
                value={selectedLoadHours}
                onChange={(hours) => {
                  setLiveMode(false);
                  handleLoadRangeChange(hours);
                }}
                disabled={!liveMode && isLoadLoading}
                messages={t}
                showLive
                isLive={liveMode}
                onLive={() => setLiveMode(true)}
              />
            </div>

            <div className="relative">
              {!liveMode && loadError ? (
                <HistoryError
                  lang={lang}
                  retry={retryLoad}
                  loading={isLoadLoading}
                />
              ) : null}
              {!liveMode && isLoadLoading ? (
                <DetailLoading label={t.loadingData} />
              ) : null}
              <div
                className={`grid grid-cols-1 gap-3 lg:grid-cols-3 ${metricsPanelClass} ${liveMode ? livePanelClass : ""}`}
              >
                <div className={chartCardClass}>
                  <MiniLineChart
                    icon={Cpu}
                    data={pick(live.cpu, displayedCpuHistory)}
                    color={ZEN_CHART.cpu}
                    maxVal={100}
                    unitMode="percent"
                    title={t.cpu}
                    label1="CPU"
                    theme={theme}
                    timeRange={chartTimeRange}
                    messages={t}
                    hasData={chartHas(liveHasData, cpuHist.hasData || loadHist.hasData)}
                    timestamps={chartTimestamps}
                    extraSeries={cpuLoadExtraSeries}
                  />
                </div>
                <div className={chartCardClass}>
                  <MiniLineChart
                    icon={MemoryStick}
                    data={pick(live.mem, displayedMemHistory)}
                    data2={pick(live.swap, displayedSwapHistory)}
                    color={ZEN_CHART.mem}
                    color2={ZEN_CHART.swap}
                    maxVal={100}
                    unitMode="percent"
                    title={t.lblMemoryUsage}
                    label1="RAM"
                    label2="SWAP"
                    theme={theme}
                    timeRange={chartTimeRange}
                    messages={t}
                    hasData={chartHas(liveHasData, memHist.hasData || swapHist.hasData)}
                    timestamps={chartTimestamps}
                  />
                </div>
                <div className={chartCardClass}>
                  <MiniLineChart
                    icon={HardDrive}
                    data={pick(live.disk, displayedDiskHistory)}
                    color={ZEN_CHART.disk}
                    maxVal={100}
                    unitMode="percent"
                    title={t.lblDiskCoverage}
                    label1={t.lblDiskUsedShort}
                    theme={theme}
                    timeRange={chartTimeRange}
                    messages={t}
                    hasData={chartHas(liveHasData, diskHist.hasData)}
                    timestamps={chartTimestamps}
                  />
                </div>
                <div className={chartCardClass}>
                  <MiniLineChart
                    icon={ArrowLeftRight}
                    data={pick(live.netIn, displayedNetInHistory)}
                    data2={pick(live.netOut, displayedNetOutHistory)}
                    color={ZEN_CHART.netIn}
                    color2={ZEN_CHART.netOut}
                    maxVal={pick(
                      Math.max(1, ...live.netIn, ...live.netOut),
                      netRawMax,
                    )}
                    unitMode="speed"
                    title={t.lblNetworkSpeedRxTx}
                    label1="RX"
                    label2="TX"
                    theme={theme}
                    timeRange={chartTimeRange}
                    messages={t}
                    hasData={chartHas(
                      liveHasData,
                      netInHist.hasData || netOutHist.hasData,
                    )}
                    timestamps={chartTimestamps}
                  />
                </div>
                <div className={chartCardClass}>
                  <MiniLineChart
                    icon={Layers}
                    data={pick(live.tcp, displayedTcpHistory)}
                    data2={pick(live.udp, displayedUdpHistory)}
                    color={ZEN_CHART.tcp}
                    color2={ZEN_CHART.udp}
                    maxVal={pick(
                      Math.max(10, ...live.tcp, ...live.udp),
                      Math.max(
                        10,
                        ...numOnly(displayedTcpHistory),
                        ...numOnly(displayedUdpHistory),
                      ),
                    )}
                    unitMode="count"
                    title={t.lblNetworkConnections}
                    label1="TCP"
                    label2="UDP"
                    theme={theme}
                    timeRange={chartTimeRange}
                    messages={t}
                    hasData={chartHas(liveHasData, tcpHist.hasData || udpHist.hasData)}
                    timestamps={chartTimestamps}
                  />
                </div>
                <div className={chartCardClass}>
                  <MiniLineChart
                    icon={List}
                    data={pick(live.proc, displayedProcessesHistory)}
                    color={ZEN_CHART.proc}
                    maxVal={pick(
                      Math.max(10, ...live.proc),
                      Math.max(10, ...numOnly(displayedProcessesHistory)),
                    )}
                    unitMode="count"
                    title={t.lblProcessCount}
                    label1={t.lblActiveProc}
                    theme={theme}
                    timeRange={chartTimeRange}
                    messages={t}
                    hasData={chartHas(liveHasData, procHist.hasData)}
                    timestamps={chartTimestamps}
                  />
                </div>
                {!liveMode && tempHist.hasData && currentTemperature > 0 ? (
                  <div className={chartCardClass}>
                    <MiniLineChart
                      data={displayedTemperatureHistory}
                      color="var(--zen-warning)"
                      maxVal={Math.max(100, ...numOnly(displayedTemperatureHistory))}
                      unitMode="count"
                      title={t.lblSystemTemperature}
                      label1={t.lblSystemTemperature}
                      theme={theme}
                      timeRange={selectedLoadHours}
                      messages={t}
                      hasData
                      timestamps={histTimestamps}
                      valueFormatter={(value) => `${value.toFixed(0)} °C`}
                    />
                  </div>
                ) : null}
                {!liveMode
                  ? gpuCharts.map((gpu) => (
                      <div
                        key={`${gpu.device_index}:${gpu.device_name}`}
                        className={chartCardClass}
                      >
                        <MiniLineChart
                          data={gpu.utilization}
                          data2={gpu.memory}
                          color="var(--zen-series-cpu)"
                          color2={ZEN_CHART.mem}
                          maxVal={100}
                          unitMode="percent"
                          title={`${t.lblGpu} ${gpu.device_index + 1}`}
                          label1={t.lblGpuUtilization}
                          label2={t.lblGpuMemory}
                          theme={theme}
                          timeRange={selectedLoadHours}
                          messages={t}
                          hasData={
                            gpu.utilization.some(isNum) || gpu.memory.some(isNum)
                          }
                          timestamps={gpu.timestamps}
                          subMetrics={
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-zen-fg-muted">
                              <span className="min-w-0 flex-1 truncate" title={gpu.device_name}>
                                {gpu.device_name}
                              </span>
                              {gpu.reading ? (
                                <span className="inline-flex shrink-0 items-center gap-3 tabular-nums">
                                  <span className="font-medium text-zen-fg-strong">
                                    {formatStoragePair(
                                      gpu.reading.memUsed / 1024 ** 3,
                                      gpu.reading.memTotal / 1024 ** 3,
                                    )}
                                  </span>
                                  <span className="font-semibold text-zen-warning">
                                    {gpu.reading.temperature} °C
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          }
                        />
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </DetailSection>

          {recordEnabled ? (
            <DetailSection delay={160}>
              <section className={detailCardClass}>
                <LatencyProbePanel
                  uuid={node.id}
                  hours={pingHours}
                  onLoadingChange={setIsPingLoading}
                  selectedProbes={selectedProbes}
                  onToggleProbe={handleToggleProbe}
                  lang={lang}
                  theme={theme}
                  taskIds={pingTaskIds}
                  title={t.tabLatency}
                  rangeSlot={
                    <DetailRangeChips
                      hours={pingHistoryHours}
                      value={selectedPingHours}
                      onChange={(hours) => {
                        setPingLive(false);
                        handlePingRangeChange(hours);
                      }}
                      disabled={isPingLoading}
                      messages={t}
                      showLive={pingMaxHours >= 1}
                      isLive={pingLive}
                      onLive={() => setPingLive(true)}
                    />
                  }
                />
              </section>
            </DetailSection>
          ) : null}
        </>
      ) : (
        <DetailSection delay={60} className="space-y-3">
          {hardwareCard}
          <section className={`${detailCardClass} py-10 text-center`}>
            <p className="text-base font-semibold text-zen-danger/80">
              {t.vpsHostOffline}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zen-fg-muted">
              {t.hostOfflineWarning}
            </p>
            <p className="mt-2 text-xs text-zen-fg-faint">
              {t.msgNodeOfflineAwaiting}
            </p>
          </section>
        </DetailSection>
      )}
    </div>
  );
}
