/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { VPSNode } from "../types";
import { translations, Lang, type Messages } from "../lib/i18n";
import type { LiveRecord } from "@/types/LiveData";
import { LatencyProbePanel } from "@/components/detail/LatencyProbePanel";
import { HistoryRangeSelector } from "@/components/detail/HistoryRangeSelector";
import { useLoadRecords } from "@/hooks/useLoadRecords";
import { useRecordSettings } from "@/hooks/useRecordSettings";
import {
  buildMetricHistory,
  formatLoadAverage,
  loadTotalsFromNode,
  normalizeLoadSeries,
} from "@/lib/recordTransform";
import {
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
import { Flag } from "@/components/Flag";
import { OsIcon } from "@/components/OsIcon";
import { NodeTags } from "@/components/NodeTags";
import { parseNodeTags } from "@/lib/parseNodeTags";
import { useChartScrub } from "@/hooks/useChartScrub";
import { useLiveSeries } from "@/hooks/useLiveSeries";
import { zenType, zenTouch } from "@/lib/typography";
import { zenBorder, zenFill, zenPopover, zenText } from "@/lib/zenSemantics";
import { zenMotion } from "@/lib/zenMotion";
import { ZenTabControl } from "@/components/motion/ZenTabControl";

interface NodeDetailProps {
  node: VPSNode;
  lang: Lang;
  theme: "light" | "dark";
  recentRecords?: LiveRecord[];
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
  const base = "transition-[opacity,filter] duration-500 ease-out";
  if (busy) {
    return `${base} opacity-40 blur-[1.5px] pointer-events-none select-none`;
  }
  if (revealing) {
    return `${base} ${zenMotion.contentReveal}`;
  }
  return `${base} opacity-100 blur-0`;
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
  cpu: "var(--zen-chart-cpu)",
  mem: "var(--zen-chart-mem)",
  swap: "var(--zen-chart-swap)",
  load: "var(--zen-chart-load)",
  netIn: "var(--zen-chart-net-in)",
  netOut: "var(--zen-chart-net-out)",
  tcp: "var(--zen-chart-tcp)",
  udp: "var(--zen-chart-udp)",
} as const;

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
}: {
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
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const rawMax = React.useMemo(
    () =>
      Math.max(
        maxVal,
        ...data.filter(isNum),
        ...(data2?.filter(isNum) ?? []),
        ...(extraSeries?.flatMap((s) => s.data.filter(isNum)) ?? []),
        0.001,
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
      ? scaleSpeedValue(rawMax, speedScale) * 1.15
      : rawMax;

  const formatDisplay = (v: number) => {
    if (valueFormatter) return valueFormatter(v);
    if (unitMode === "speed") return formatBytesPerSec(v);
    if (unitMode === "percent") return formatPercent(v);
    return String(Math.round(v));
  };

  const axisMaxLabel =
    unitMode === "speed"
      ? formatSpeedAxisMax(rawMax)
      : `${chartMax.toFixed(0)}${unitMode === "percent" ? unit : ""}`;

  const showDecimals = decimals ?? unitMode === "percent";

  const width = 500;
  const height = 120;
  const paddingX = 16;
  const paddingY = 15;
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
    }),
    [chartData.length, chartWidth],
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
    const toPoint = (val: number | null, x: number): ChartPt | null => {
      if (val == null) return null;
      const y =
        baseY -
        (Math.max(0, Math.min(maxValSafe, val)) / maxValSafe) * chartHeight;
      return { x, y, val };
    };

    const points1 = chartData.map((val, i) =>
      toPoint(val, paddingX + (i / denominator) * chartWidth),
    );

    const denominator2 = chartData2 ? Math.max(1, chartData2.length - 1) : 1;
    const points2 = chartData2
      ? chartData2.map((val, i) =>
          toPoint(val, paddingX + (i / denominator2) * chartWidth),
        )
      : null;

    const extraLayers = (extraSeries ?? []).map((series) => {
      const denominatorExtra = Math.max(1, series.data.length - 1);
      const points = series.data.map((val, i) =>
        toPoint(val, paddingX + (i / denominatorExtra) * chartWidth),
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
  ]);
  const { points1, points2, extraLayers, pathD, areaD, pathD2, areaD2 } =
    chartGeometry;

  // Grid lines
  const gridLines = React.useMemo(() => [0.25, 0.5, 0.75, 1], []);

  const strokeColor = theme === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
  const labelColor = `${zenText.subtle} font-mono`;

  const isHovering = hoveredIndex !== null;
  const lastIdx1 = lastValidIndex(chartData);
  const activeIdx =
    hoveredIndex !== null
      ? hoveredIndex
      : lastIdx1 >= 0
        ? lastIdx1
        : chartData.length - 1;

  const displayVal1 = data[activeIdx] ?? 0;
  const displayVal2 = data2 ? (data2[activeIdx] ?? 0) : null;

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

  const fallbackX = paddingX + (activeIdx / denominator) * chartWidth;
  const activeX = points1[activeIdx]?.x ?? fallbackX;
  const activeY1 = points1[activeIdx]?.y ?? baseY;
  const activeY2 = points2 && points2[activeIdx] ? points2[activeIdx]!.y : baseY;
  const activeExtraYs = extraLayers.map(
    (layer) => layer.points[activeIdx]?.y ?? baseY,
  );
  const minY = Math.min(
    activeY1,
    points2 && points2[activeIdx] ? activeY2 : activeY1,
    ...(activeExtraYs.length ? activeExtraYs : [activeY1]),
  );

  const safeId = title.replace(/[^a-zA-Z0-9]/g, "_");

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="group py-2 flex flex-col space-y-3 cursor-crosshair"
    >
      <div className="flex items-center gap-3 select-none">
        <span className={`shrink-0 font-extrabold tracking-wider uppercase ${zenType.body} ${zenText.primary} font-mono`}>{title}</span>
        <span className="h-px flex-1 bg-zen-line" aria-hidden />
        <div className={`shrink-0 flex items-center justify-end gap-2 sm:gap-3 ${zenType.data} font-mono select-none font-bold`}>
          {isHovering && (
            <span className={`${zenType.label} text-zen-fg-muted bg-zen-fill-muted/10 px-1.5 py-0.5 rounded tracking-wide font-bold tabular-nums`}>
              {hoverLabel}
            </span>
          )}
          <span style={{ color }}>● {formatDisplay(displayVal1)}</span>
          {displayVal2 !== null && (
            <span style={{ color: color2 }}>● {formatDisplay(displayVal2)}</span>
          )}
        </div>
      </div>

      <div className="relative pointer-events-none">
        {!hasData ? (
          <div
            className={`h-28 sm:h-32 md:h-24 flex items-center justify-center ${zenType.caption} uppercase tracking-widest font-mono ${zenText.faint}`}
          >
            {messages.noHistory}
          </div>
        ) : (
        <>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-28 sm:h-32 md:h-24 overflow-visible">
          <defs>
            <linearGradient id={`grad-${safeId}-1`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
            {data2 && (
              <linearGradient id={`grad-${safeId}-2`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color2} stopOpacity="0.15" />
                <stop offset="100%" stopColor={color2} stopOpacity="0.0" />
              </linearGradient>
            )}
          </defs>

          {/* Grid lines */}
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
                strokeDasharray="2,4"
              />
            );
          })}
          {/* Vertical Grid ticks */}
          {Array.from({ length: 5 }).map((_, i) => {
            const x = paddingX + (i / 4) * chartWidth;
            return (
              <line
                key={i}
                x1={x}
                y1={paddingY}
                x2={x}
                y2={height - paddingY}
                stroke={strokeColor}
                strokeDasharray="2,4"
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
          {areaD2 && (
            <path d={areaD2} fill={`url(#grad-${safeId}-2)`} />
          )}
          {/* Line 2 */}
          {pathD2 && (
            <path
              d={pathD2}
              stroke={color2}
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              className="opacity-80"
            />
          )}

          {/* Area 1 */}
          {areaD && (
            <path d={areaD} fill={`url(#grad-${safeId}-1)`} />
          )}
          {/* Line 1 */}
          {pathD && (
            <path
              d={pathD}
              stroke={color}
              strokeWidth="1.5"
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
              stroke={theme === "dark" ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.45)"}
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          )}

        </svg>

        {/* Hover point markers only — HTML overlay so they stay perfectly round
            despite the non-uniform SVG stretch (preserveAspectRatio="none"). */}
        {isHovering && lastIdx1 >= 0 && (
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
        {isHovering && points2 && lastValidIndex(chartData2 ?? []) >= 0 && (
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
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }}></span>
                <span>{label1}:</span>
              </span>
              <span className="font-bold" style={{ color }}>{formatDisplay(displayVal1)}</span>
            </div>
            {displayVal2 !== null && (
              <div className="flex items-center gap-4 whitespace-nowrap justify-between">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color2 }}></span>
                  <span>{label2 || "VALUE 2"}:</span>
                </span>
                <span className="font-bold" style={{ color: color2 }}>{formatDisplay(displayVal2)}</span>
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
                  <span className="font-bold" style={{ color: layer.color }}>
                    {shown}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className={`absolute top-0.5 left-1 ${zenType.micro} leading-none ${labelColor} pointer-events-none select-none`}>
          MAX: {axisMaxLabel}
        </div>
        <div className={`absolute bottom-0.5 left-1 ${zenType.micro} leading-none ${labelColor} pointer-events-none select-none`}>
          MIN: {unitMode === "percent" ? `0${unit}` : "0"}
        </div>
        </>
        )}
      </div>

      {subMetrics && <div className="pt-1.5">{subMetrics}</div>}
    </div>
  );
};


function splitTextAtFirstLine(
  text: string,
  maxWidth: number,
  referenceEl: HTMLElement,
): { first: string; rest: string } {
  if (!text || maxWidth <= 0) return { first: text, rest: "" };

  const style = getComputedStyle(referenceEl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { first: text, rest: "" };

  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const measure = (value: string) => ctx.measureText(value).width;

  if (measure(text) <= maxWidth) return { first: text, rest: "" };

  let lo = 1;
  let hi = text.length;
  let best = 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (measure(text.slice(0, mid)) <= maxWidth) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  let splitAt = best;
  const spaceIdx = text.lastIndexOf(" ", splitAt);
  if (spaceIdx > 0) splitAt = spaceIdx;

  const first = text.slice(0, splitAt).trimEnd();
  const rest = text.slice(splitAt).trimStart();
  if (!first) {
    return { first: text.slice(0, best), rest: text.slice(best).trimStart() };
  }
  return { first, rest };
}


export function NodeDetail({
  node,
  lang,
  theme,
  recentRecords = [],
  onBack,
}: NodeDetailProps) {
  const t = translations[lang];
  const { recordEnabled, loadPresets, pingPresets } = useRecordSettings();

  const [selectedLoadHours, setSelectedLoadHours] = React.useState(
    () => loadPresets[0] ?? 1,
  );
  const [selectedPingHours, setSelectedPingHours] = React.useState(
    () => pingPresets[0] ?? 1,
  );
  const [isPingLoading, setIsPingLoading] = React.useState(false);
  const [subSection, setSubSection] = React.useState<"metrics" | "latency">(
    "metrics",
  );
  const [liveMode, setLiveMode] = React.useState(true);
  const [selectedProbes, setSelectedProbes] = React.useState<string[]>([]);

  const liveSamples = useLiveSeries(node, recordEnabled && node.online);

  React.useEffect(() => {
    if (loadPresets.length === 0) return;
    if (!loadPresets.includes(selectedLoadHours)) {
      setSelectedLoadHours(loadPresets[0]);
    }
  }, [loadPresets, selectedLoadHours]);

  React.useEffect(() => {
    if (pingPresets.length === 0) return;
    if (!pingPresets.includes(selectedPingHours)) {
      setSelectedPingHours(pingPresets[0]);
    }
  }, [pingPresets, selectedPingHours]);

  const loadHours =
    recordEnabled && node.online && !liveMode ? selectedLoadHours : 0;
  const {
    records: loadRecords,
    isLoading: isLoadLoading,
  } = useLoadRecords(node.id, loadHours);

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

  const activePresets =
    subSection === "metrics" ? loadPresets : pingPresets;
  const activeHours =
    subSection === "metrics" ? selectedLoadHours : selectedPingHours;
  const activeRangeLoading =
    subSection === "metrics" ? isLoadLoading : isPingLoading;
  const handleActiveRangeChange =
    subSection === "metrics" ? handleLoadRangeChange : handlePingRangeChange;

  const monitoringSectionIndex =
    t.sectionResourceMonitoring.match(/^\[[^\]]+\]/)?.[0] ?? "[03]";

  // Helper to format speeds (node fields are KB/s)
  const formatSpeed = (kbps: number) => formatKbps(kbps);

  const renderProgressBar = (percent: number, colorClass: string) => {
    const totalSegments = 32;
    return (
      <div className="flex items-center justify-between gap-[3px] w-full my-2 select-none">
        {Array.from({ length: totalSegments }).map((_, i) => {
          const isActive = (i / totalSegments) * 100 < percent;
          return (
            <div
              key={i}
              className="flex-1 flex items-center justify-center"
              style={{ height: "4px" }}
            >
              {isActive ? (
                <div className={`w-full h-full rounded-[1px] transition-all duration-300 ${colorClass}`} />
              ) : (
                <div className={`w-[2px] h-[2px] rounded-full transition-all duration-300 ${
                  zenFill.track
                }`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const memPercent = node.online ? (node.memoryUsed / node.memoryTotal) * 100 : 0;
  const diskPercent = node.online ? (node.diskUsed / node.diskTotal) * 100 : 0;

  // Design accent variables
  const textPrimary = zenText.primary;
  const textMuted = zenText.muted;
  const textBody = zenText.primary;
  const textSecondary = zenText.secondary;

  const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-3">
      <span
        className={`shrink-0 font-extrabold ${zenType.body} zen-track-tight uppercase ${textSecondary} font-mono`}
      >
        {children}
      </span>
      <span className="h-px flex-1 bg-zen-line" aria-hidden />
    </div>
  );

  const loadTotals = React.useMemo(() => loadTotalsFromNode(node), [node]);

  const metricHistory = React.useMemo(() => {
    const buildHistory = (
      metric: Parameters<typeof buildMetricHistory>[0],
    ) =>
      buildMetricHistory(
        metric,
        selectedLoadHours,
        loadTotals,
        loadRecords,
        recentRecords,
      );

    return {
      cpu: buildHistory("cpu"),
      load: buildHistory("load1"),
      mem: buildHistory("mem"),
      swap: buildHistory("swap"),
      disk: buildHistory("disk"),
      netIn: buildHistory("netin"),
      netOut: buildHistory("netout"),
      tcp: buildHistory("tcp"),
      udp: buildHistory("udp"),
      proc: buildHistory("processes"),
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

  const displayedCpuHistory = cpuHist.values;
  const displayedMemHistory = memHist.values;
  const displayedSwapHistory = swapHist.values;
  const displayedDiskHistory = diskHist.values;
  const displayedNetInHistory = netInHist.values;
  const displayedNetOutHistory = netOutHist.values;
  const displayedTcpHistory = tcpHist.values;
  const displayedUdpHistory = udpHist.values;
  const displayedProcessesHistory = procHist.values;

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
  const metricsReveal = useContentReveal(isLoadLoading);
  const pingReveal = useContentReveal(isPingLoading);
  const liveReveal = useContentReveal(liveMode && !liveHasData);
  const metricsPanelClass = contentPanelMotion(isLoadLoading, metricsReveal);
  const pingPanelClass = contentPanelMotion(isPingLoading, pingReveal);
  const livePanelClass =
    liveMode && !liveHasData
      ? "transition-opacity duration-500 ease-out opacity-35"
      : liveReveal
        ? `${zenMotion.contentReveal} transition-opacity duration-500 ease-out opacity-100`
        : "transition-opacity duration-500 ease-out opacity-100";
  // Approximate window span in hours for the hover "time ago" label.
  const liveTimeRange = Math.max(1, liveSamples.length) * 2 / 3600;
  const pick = <T,>(liveVal: T, histVal: T): T => (liveMode ? liveVal : histVal);

  // Absolute timestamp (epoch ms) per chart point, for the hover label.
  const liveTimestamps = live.timestamps;
  const histLen = displayedCpuHistory.length;
  const histTimestamps = React.useMemo(() => {
    const histNow = Date.now();
    return Array.from({ length: histLen }, (_, i) =>
      histNow -
      ((histLen - 1 - i) / Math.max(1, histLen - 1)) *
        selectedLoadHours *
        3600_000,
    );
  }, [histLen, selectedLoadHours]);
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
  const groupHref = groupName
    ? `/?group=${encodeURIComponent(groupName)}`
    : "";
  const headerGroupClass =
    "text-sm font-black tracking-wide font-mono leading-none";
  const headerMetaSepClass =
    "text-sm font-black tracking-widest uppercase font-mono leading-none";
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
    if (!hasExpiry || !expiryState) return t.billingNotSet;
    if (expiryState.kind === "long_term") return t.billingLongTerm;
    if (expiryState.kind === "expired") return t.billingExpired;
    return formatUpdatedAt(node.expiredAt);
  })();
  const renewalPriceLabel = hasRenewalPrice
    ? formatPriceLine(
        node.price,
        node.currency,
        node.billingCycle,
        billingLabels,
      ) ?? t.billingNoInfo
    : null;
  const expiryValueClass =
    expiryState?.kind === "expired" ||
    (expiryState?.kind === "active" && expiryState.daysRemaining <= 7)
      ? "text-zen-danger font-bold"
      : textPrimary;
  const titleLineClass = `font-black leading-snug ${textPrimary} text-xl sm:text-2xl tracking-tight break-words`;
  const titleRowRef = React.useRef<HTMLDivElement>(null);
  const titleMeasureRef = React.useRef<HTMLSpanElement>(null);
  const [{ first: titleFirstLine, rest: titleRest }, setTitleSplit] = React.useState({
    first: node.name,
    rest: "",
  });

  React.useLayoutEffect(() => {
    const row = titleRowRef.current;
    const measureEl = titleMeasureRef.current;
    if (!row || !measureEl) return;

    const run = () => {
      const nameSlot = row.querySelector<HTMLElement>("[data-title-slot]");
      const width = nameSlot?.clientWidth ?? 0;
      if (width <= 0) {
        setTitleSplit({ first: node.name, rest: "" });
        return;
      }
      setTitleSplit(splitTextAtFirstLine(node.name, width, measureEl));
    };

    run();
    const ro = new ResizeObserver(run);
    ro.observe(row);
    return () => ro.disconnect();
  }, [node.name]);

  return (
    <div className={`font-sans ${zenType.body} select-none space-y-6 md:space-y-8 pt-1 pb-4`}>
      {/* Title block — back inline with node name */}
      <DetailSection delay={0} className="space-y-2.5 md:space-y-3">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-x-10 lg:gap-x-14">
          <div className="min-w-0 flex-1">
            <span
              ref={titleMeasureRef}
              className={`${titleLineClass} pointer-events-none fixed left-[-9999px] top-0 opacity-0`}
              aria-hidden="true"
            />
            <h2 className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0">
              {node.name}
            </h2>
            <div ref={titleRowRef} className="flex items-center gap-x-3">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label={t.backToList}
                  className={`group inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zen-line px-2.5 py-1.5 font-mono ${zenType.caption} font-bold tracking-wider uppercase leading-none cursor-pointer transition-all ${
                    theme === "dark"
                      ? "bg-zen-surface/50 text-zen-fg-muted hover:border-zen-fg-muted hover:text-zen-fg-strong hover:bg-zen-elevate"
                      : "bg-zen-surface/80 text-zen-fg-subtle hover:border-zen-fg-faint hover:text-zen-fg-strong hover:bg-zen-fill-muted/20"
                  }`}
                >
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                  {t.backToList}
                </button>
              ) : null}
              <Flag flag={node.flag} className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span data-title-slot className="min-w-0 flex-1" aria-hidden="true">
                <span className={titleLineClass}>{titleFirstLine}</span>
              </span>
            </div>
            {titleRest ? (
              <p className={titleLineClass} aria-hidden="true">
                {titleRest}
              </p>
            ) : null}
          </div>
          {hasHeaderMeta ? (
            <div className="inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1.5 md:justify-end shrink-0 leading-normal">
              {groupName ? (
                <Link
                  to={groupHref}
                  className={`${headerGroupClass} ${textSecondary} shrink-0 transition-colors hover:text-zen-accent`}
                >
                  {groupName}
                </Link>
              ) : null}
              {showSepAfterGroup ? (
                <span
                  className={`${headerMetaSepClass} font-light opacity-40 ${textMuted} shrink-0 select-none`}
                  aria-hidden
                >
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
        <DetailSection delay={60} className="space-y-2.5">
          {hasPublicRemark ? (
            <div
              className={`font-mono ${zenType.data} leading-relaxed ${
                zenText.secondary
              }`}
            >
              <span
                className={`mb-1 block ${zenType.label} font-bold uppercase zen-track-tight ${
                  zenText.subtle
                }`}
              >
                {t.publicRemark}
              </span>
              <p className={`whitespace-pre-wrap break-words ${textPrimary}`}>
                {publicRemarkText}
              </p>
            </div>
          ) : null}
          {hasPrivateRemark ? (
            <div
              className={`font-mono ${zenType.data} leading-relaxed ${
                zenText.secondary
              }`}
            >
              <span
                className={`mb-1 block ${zenType.label} font-bold uppercase zen-track-tight ${
                  zenText.subtle
                }`}
              >
                {t.privateRemark}
              </span>
              <p className={`whitespace-pre-wrap break-words ${textPrimary}`}>
                {privateRemarkText}
              </p>
            </div>
          ) : null}
        </DetailSection>
      ) : null}

      {node.online ? (
        <>
          {/* Main 2x2 Mono Section Grid */}
          <div className="grid grid-cols-1 gap-x-16 gap-y-8 md:grid-cols-2 pt-2">
            {/* Column 1: Hardware Specifications */}
            <DetailSection delay={80} className="space-y-4">
              <SectionHeading>{t.hardwareSpec}</SectionHeading>
              <div className={`grid grid-cols-2 gap-y-3 ${zenType.data} font-mono border-b pb-6 border-transparent`}>
                <span className={textMuted}>{t.lblCpuVendor}</span>
                <span className={`font-bold ${textPrimary}`}>{node.cpuVendor}</span>

                <span className={textMuted}>{t.lblCpuCores}</span>
                <span className={`font-bold ${textPrimary}`}>{node.cpuCores} {t.lblCpuThreads}</span>

                <span className={textMuted}>{t.lblArch}</span>
                <span className={`font-bold ${textPrimary}`}>{node.arch}</span>

                <span className={textMuted}>{t.lblSystemOs}</span>
                <span className={`font-bold ${textPrimary} flex items-center gap-2`}>
                  <OsIcon os={node.os} />
                  {node.os}
                </span>

                {node.kernelVersion ? (
                  <>
                    <span className={textMuted}>{t.lblKernel}</span>
                    <span className={`font-bold ${textPrimary} break-all`}>{node.kernelVersion}</span>
                  </>
                ) : null}

                {node.virtualization ? (
                  <>
                    <span className={textMuted}>{t.lblVirtualization}</span>
                    <span className={`font-bold ${textPrimary}`}>{node.virtualization}</span>
                  </>
                ) : null}

                {node.gpuName ? (
                  <>
                    <span className={textMuted}>{t.lblGpu}</span>
                    <span className={`font-bold ${textPrimary} break-all`}>{node.gpuName}</span>
                  </>
                ) : null}

                <span className={textMuted}>{t.lblUptimeSec}</span>
                <span className={`font-bold ${textPrimary}`}>
                  {node.online && node.uptimeSec > 0
                    ? formatUptime(node.uptimeSec, {
                        day: t.unitDay,
                        hour: t.unitHour,
                        minute: t.unitMin,
                        second: t.unitSec,
                      })
                    : "—"}
                </span>

                {hasClientVersion ? (
                  <>
                    <span className={textMuted}>{t.lblKomariVersion}</span>
                    <span className={`font-bold ${textPrimary}`}>
                      {node.clientVersion.trim()}
                    </span>
                  </>
                ) : null}

                {expiryLabel ? (
                  <>
                    <span className={textMuted}>{t.lblExpiredAt}</span>
                    <span className={`font-bold ${expiryValueClass}`}>
                      {expiryLabel}
                    </span>
                  </>
                ) : null}

                <span className={textMuted}>{t.lblLastUpdated}</span>
                <span className={`font-bold ${textPrimary}`}>
                  {formatUpdatedAt(node.updatedAt)}
                </span>

                {hasRenewalPrice && renewalPriceLabel ? (
                  <>
                    <span className={textMuted}>{t.lblRenewalPrice}</span>
                    <span className={`inline-flex flex-wrap items-baseline gap-y-0.5 font-bold ${textPrimary}`}>
                      {hasRemainingValue ? (
                        <>
                          <span>
                            {renewalPriceLabel}｜{remainingValueLabel}
                          </span>
                          <span
                            className={`ml-1 ${zenType.label} ${textMuted} font-bold uppercase leading-none opacity-70`}
                            title={t.billingRemainingValueTitle}
                          >
                            {t.billingRemainingValueShort}
                          </span>
                        </>
                      ) : (
                        <span>{renewalPriceLabel}</span>
                      )}
                    </span>
                  </>
                ) : null}
              </div>
            </DetailSection>

            {/* Column 2: System Loads & Memory */}
            <DetailSection delay={140} className="space-y-4">
              <SectionHeading>{t.capacityLoads}</SectionHeading>
              <div className="space-y-6">
                <div>
                  <div className={`flex justify-between ${zenType.data} ${textSecondary} mb-2 tracking-wider font-mono`}>
                    <span>{t.lblCpuLoadUtil}</span>
                    <span className={`font-black ${textPrimary} font-mono text-xs`}>{node.cpuUsage.toFixed(1)}%</span>
                  </div>
                  {renderProgressBar(node.cpuUsage, "bg-zen-accent/80")}
                  <div className={`${zenType.caption} ${textMuted} mt-2 font-mono`}>
                    {t.lblLoadAvg} [{node.loadAvg}]
                  </div>
                </div>

                <div>
                  <div className={`flex justify-between ${zenType.data} ${textSecondary} mb-2 tracking-wider font-mono`}>
                    <span>{t.lblMemoryAllocated}</span>
                    <span className={`font-black ${textPrimary} font-mono text-xs`}>
                      {formatStoragePair(node.memoryUsed, node.memoryTotal)}
                    </span>
                  </div>
                  {renderProgressBar(memPercent, "bg-zen-chart-mem/80")}
                  <div className={`${zenType.caption} ${textMuted} mt-2 font-mono`}>
                    SWAP: {formatStoragePair(node.swapUsed, node.swapTotal)}
                  </div>
                </div>

                <div className="pt-2">
                  <div className={`flex justify-between ${zenType.data} ${textSecondary} mb-2 tracking-wider font-mono`}>
                    <span>{t.lblDisk}</span>
                    <span className={`font-black ${textPrimary} font-mono text-xs`}>
                      {node.diskUsed.toFixed(1)} GB / {node.diskTotal.toFixed(1)} GB
                    </span>
                  </div>
                  {renderProgressBar(diskPercent, "bg-zen-chart-load/80")}
                </div>

                {/* Network RX/TX */}
                <div className="pt-2">
                  <div className={`flex items-center gap-2 ${zenType.data} ${textSecondary} mb-3 tracking-wider font-mono uppercase`}>
                    <span className="font-bold shrink-0">{t.lblNetworkSpeedRxTx}</span>
                    <span className="h-px flex-1 bg-zen-line" aria-hidden />
                  </div>
                  <div className={`grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-4 gap-y-3 ${zenType.data} font-mono`}>
                    {/* Left: current in/out speeds */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
                        <span className={`inline-flex items-center gap-1.5 min-w-0 whitespace-nowrap ${textMuted} uppercase font-bold tracking-wider`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-zen-chart-net-in animate-pulse shrink-0" />
                          {t.lblInboundRxShort}
                        </span>
                        <span className={`font-black ${textPrimary} whitespace-nowrap shrink-0 tabular-nums`}>
                          {formatSpeed(node.netSpeedIn)}
                        </span>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
                        <span className={`inline-flex items-center gap-1.5 min-w-0 whitespace-nowrap ${textMuted} uppercase font-bold tracking-wider`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-zen-chart-net-out animate-pulse shrink-0" />
                          {t.lblOutboundTxShort}
                        </span>
                        <span className={`font-black ${textPrimary} whitespace-nowrap shrink-0 tabular-nums`}>
                          {formatSpeed(node.netSpeedOut)}
                        </span>
                      </div>
                    </div>
                    {/* Right: cumulative traffic */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
                        <span className={`${textMuted} uppercase font-bold tracking-wider whitespace-nowrap`}>
                          {t.lblDownloaded}
                        </span>
                        <span className={`font-bold ${textPrimary} whitespace-nowrap shrink-0 tabular-nums`}>
                          {formatTrafficGb(node.bandwidthUsedIn)}
                        </span>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
                        <span className={`${textMuted} uppercase font-bold tracking-wider whitespace-nowrap`}>
                          {t.lblUploaded}
                        </span>
                        <span className={`font-bold ${textPrimary} whitespace-nowrap shrink-0 tabular-nums`}>
                          {formatTrafficGb(node.bandwidthUsedOut)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`flex justify-between items-baseline pt-3 mt-3 border-t ${zenBorder.line} ${zenType.caption} font-mono`}>
                    {node.bandwidthTotal <= 0 ? (
                      <span
                        className={`inline-flex shrink-0 px-1 py-px rounded-sm border ${zenType.micro} font-bold tracking-wide leading-none ${unlimitedTrafficBadgeClass}`}
                      >
                        <span className={unlimitedTrafficSymbolClass}>∞</span>
                      </span>
                    ) : (
                      <span className={`${textMuted} uppercase font-bold tracking-wider`}>
                        {getTrafficTypeFullLabel(node.trafficLimitType, t)}
                      </span>
                    )}
                    <span className={`font-bold ${textPrimary}`}>{formatNodeTraffic(node)}</span>
                  </div>
                </div>
              </div>
            </DetailSection>
          </div>

          {/* [05] UNIFIED DYNAMIC HARDWARE TIMESERIES & SYSTEM PROCESS TELEMETRY / LATENCY MONITORING */}
          {recordEnabled && (
          <DetailSection delay={200} className="space-y-4 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className={`shrink-0 font-extrabold ${zenType.body} zen-track-tight uppercase ${textSecondary} font-mono`}
                >
                  {monitoringSectionIndex}
                </span>
                <div className="max-w-full min-w-0 overflow-x-auto">
                  <ZenTabControl
                    tabs={[
                      { id: "metrics", label: t.tabMetrics },
                      { id: "latency", label: t.tabLatency },
                    ]}
                    value={subSection}
                    onChange={(id) =>
                      setSubSection(id as "metrics" | "latency")
                    }
                    showIndicator={false}
                    separator={
                      <span
                        className={`${textSecondary} ${zenType.body} font-extrabold select-none`}
                        aria-hidden
                      >
                        {" // "}
                      </span>
                    }
                    tabClassName={`px-0 ${zenTouch.btn} uppercase zen-track-tight whitespace-nowrap font-mono font-extrabold ${zenType.body}`}
                    activeClassName={textSecondary}
                    idleClassName={`${zenText.faint} font-semibold`}
                    className="gap-0 shrink-0 select-none"
                  />
                </div>
                <span
                  className="hidden h-px min-w-8 flex-1 bg-zen-line sm:block"
                  aria-hidden
                />
              </div>

              <div className="min-w-0 flex shrink-0 justify-start sm:justify-end sm:self-center">
                <HistoryRangeSelector
                  presets={activePresets}
                  value={activeHours}
                  onChange={(h) => {
                    if (subSection === "metrics") setLiveMode(false);
                    handleActiveRangeChange(h);
                  }}
                  disabled={activeRangeLoading}
                  theme={theme}
                  messages={t}
                  showLive={subSection === "metrics"}
                  isLive={subSection === "metrics" && liveMode}
                  onLive={() => setLiveMode(true)}
                  liveLabel={t.live}
                />
              </div>
            </div>

            <div className="relative">
              {subSection === "metrics" && isLoadLoading && (
                <div className="absolute inset-0 z-30 flex items-center justify-center select-none bg-transparent pointer-events-none">
                  <div className={`px-4 py-2.5 ${zenType.caption} uppercase font-bold zen-track-tight font-mono flex items-center gap-2.5 border rounded-sm shadow-sm ${
                    theme === "dark"
                      ? "bg-zen-surface/95 border-zen-border-muted text-zen-accent"
                      : "bg-zen-surface/95 border-zen-border text-zen-accent"
                  }`}>
                    <svg className="animate-spin h-3.5 w-3.5 text-zen-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t.loadingData}</span>
                  </div>
                </div>
              )}

              {subSection === "latency" && isPingLoading && (
                <div className="absolute inset-0 z-30 flex items-center justify-center select-none bg-transparent pointer-events-none">
                  <div className={`px-4 py-2.5 ${zenType.caption} uppercase font-bold zen-track-tight font-mono flex items-center gap-2.5 border rounded-sm shadow-sm ${
                    theme === "dark"
                      ? "bg-zen-surface/95 border-zen-border-muted text-zen-accent"
                      : "bg-zen-surface/95 border-zen-border text-zen-accent"
                  }`}>
                    <svg className="animate-spin h-3.5 w-3.5 text-zen-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t.loadingData}</span>
                  </div>
                </div>
              )}

              {subSection === "metrics" ? (
                <>
                  {/* Sub-grid of 4 charts */}
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${metricsPanelClass} ${liveMode ? livePanelClass : ""}`}>
                    {/* Chart 1: CPU Utilisation */}
                    <MiniLineChart
                      data={pick(live.cpu, displayedCpuHistory)}
                      color={ZEN_CHART.cpu}
                      maxVal={100}
                      unitMode="percent"
                      title={t.cpu}
                      label1="CPU"
                      theme={theme}
                      timeRange={pick(liveTimeRange, selectedLoadHours)}
                      messages={t}
                      hasData={
                        pick(liveHasData, cpuHist.hasData || loadHist.hasData)
                      }
                      timestamps={chartTimestamps}
                      extraSeries={cpuLoadExtraSeries}
                      subMetrics={
                        <div className={`flex justify-between items-center gap-3 ${zenType.caption} font-mono ${textMuted}`}>
                          <span>{t.lblLoadAvgShort} [{node.load5}]</span>
                          <span>{t.lblCpuCores} {node.cpuCores}</span>
                        </div>
                      }
                    />

                    {/* Chart 2: Memory & SWAP */}
                    <MiniLineChart
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
                      timeRange={pick(liveTimeRange, selectedLoadHours)}
                      messages={t}
                      hasData={pick(liveHasData, memHist.hasData || swapHist.hasData)}
                      timestamps={chartTimestamps}
                      subMetrics={
                        <div className={`grid grid-cols-2 ${zenType.caption} font-mono leading-tight`}>
                          <div className={`flex justify-between pr-4 border-r ${zenBorder.line}`}>
                            <span className={textMuted}>RAM:</span>
                            <span className={textPrimary}>{formatStoragePair(node.memoryUsed, node.memoryTotal)}</span>
                          </div>
                          <div className="flex justify-between pl-4">
                            <span className={textMuted}>SWAP:</span>
                            <span className={textPrimary}>{formatStoragePair(node.swapUsed, node.swapTotal)}</span>
                          </div>
                        </div>
                      }
                    />

                    {/* Chart 3: Disk Partition Map */}
                    <MiniLineChart
                      data={pick(live.disk, displayedDiskHistory)}
                      color={ZEN_CHART.load}
                      maxVal={100}
                      unitMode="percent"
                      title={t.lblDiskCoverage}
                      label1={t.lblDiskUsedShort}
                      theme={theme}
                      timeRange={pick(liveTimeRange, selectedLoadHours)}
                      messages={t}
                      hasData={pick(liveHasData, diskHist.hasData)}
                      timestamps={chartTimestamps}
                      subMetrics={
                        <div className={`${zenType.caption} font-mono ${textMuted}`}>
                          <span>{t.lblUsedTotal} </span>
                          <span className={textPrimary}>
                            {node.diskUsed.toFixed(1)} / {node.diskTotal.toFixed(0)} GB
                          </span>
                        </div>
                      }
                    />

                    {/* Chart 4: Network Traffic speeds */}
                    <MiniLineChart
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
                      timeRange={pick(liveTimeRange, selectedLoadHours)}
                      messages={t}
                      hasData={pick(liveHasData, netInHist.hasData || netOutHist.hasData)}
                      timestamps={chartTimestamps}
                      subMetrics={
                        <div className={`grid grid-cols-2 ${zenType.caption} font-mono leading-tight`}>
                          <div className={`flex justify-between pr-4 border-r ${zenBorder.line}`}>
                            <span className={textMuted}>RX:</span>
                            <span className="text-zen-chart-net-in font-bold">{formatSpeed(node.netSpeedIn)}</span>
                          </div>
                          <div className="flex justify-between pl-4">
                            <span className={textMuted}>TX:</span>
                            <span className="text-zen-chart-net-out font-bold">{formatSpeed(node.netSpeedOut)}</span>
                          </div>
                        </div>
                      }
                    />
                  </div>

                  {/* Integrated connection & processes flow metrics */}
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 ${metricsPanelClass} ${liveMode ? livePanelClass : ""}`}>
                    {/* Chart 5: Network Connections TCP/UDP */}
                    <MiniLineChart
                      data={pick(live.tcp, displayedTcpHistory)}
                      data2={pick(live.udp, displayedUdpHistory)}
                      color={ZEN_CHART.tcp}
                      color2={ZEN_CHART.udp}
                      maxVal={pick(
                        Math.max(120, ...live.tcp, ...live.udp, 10),
                        Math.max(120, ...numOnly(displayedTcpHistory), ...numOnly(displayedUdpHistory), 10),
                      )}
                      unitMode="count"
                      title={t.lblNetworkConnections}
                      label1="TCP"
                      label2="UDP"
                      theme={theme}
                      timeRange={pick(liveTimeRange, selectedLoadHours)}
                      messages={t}
                      hasData={pick(liveHasData, tcpHist.hasData || udpHist.hasData)}
                      timestamps={chartTimestamps}
                      subMetrics={
                        <div className={`grid grid-cols-2 ${zenType.caption} font-mono leading-tight`}>
                          <div className={`flex justify-between pr-4 border-r ${zenBorder.line}`}>
                            <span className={textMuted}>TCP:</span>
                            <span className="text-zen-chart-tcp font-bold">{node.tcpConnections ?? 0} {t.unitConnections}</span>
                          </div>
                          <div className="flex justify-between pl-4">
                            <span className={textMuted}>UDP:</span>
                            <span className="text-zen-chart-udp font-bold">{node.udpConnections ?? 0} {t.unitConnections}</span>
                          </div>
                        </div>
                      }
                    />

                    {/* Chart 6: Active Processes Count */}
                    <MiniLineChart
                      data={pick(live.proc, displayedProcessesHistory)}
                      color={ZEN_CHART.load}
                      maxVal={pick(
                        Math.max(200, ...live.proc, 10),
                        Math.max(200, ...numOnly(displayedProcessesHistory), 10),
                      )}
                      unitMode="count"
                      title={t.lblProcessCount}
                      label1={t.lblActiveProc}
                      theme={theme}
                      timeRange={pick(liveTimeRange, selectedLoadHours)}
                      messages={t}
                      hasData={pick(liveHasData, procHist.hasData)}
                      timestamps={chartTimestamps}
                      subMetrics={
                        <div className={`flex justify-between items-center ${zenType.caption} font-mono ${textMuted}`}>
                          <span>{t.lblActiveProcesses} <span className="text-zen-chart-load font-bold">{node.processesCount ?? 0}</span></span>
                          <span>{t.lblStatusOk}</span>
                        </div>
                      }
                    />
                  </div>
                </>
              ) : (
                <div className={`min-h-[28rem] ${pingPanelClass}`}>
                <LatencyProbePanel
                  uuid={node.id}
                  hours={selectedPingHours}
                  onLoadingChange={setIsPingLoading}
                  selectedProbes={selectedProbes}
                  onToggleProbe={handleToggleProbe}
                  lang={lang}
                  theme={theme}
                />
                </div>
              )}
            </div>
          </DetailSection>
          )}
        </>
      ) : (
        <DetailSection delay={80}>
        <div className="py-20 text-center text-red-500 flex flex-col items-center justify-center space-y-4 font-sans select-none">
          <span className="text-base font-extrabold tracking-widest text-red-500 uppercase">{t.vpsHostOffline}</span>
          <p className={`max-w-md ${textSecondary} ${zenType.data} uppercase tracking-wider leading-relaxed`}>
            {t.hostOfflineWarning}
          </p>
          <div className={`${zenType.caption} tracking-wider ${textMuted} uppercase font-mono`}>
            {t.msgNodeOfflineAwaiting}
          </div>
        </div>
        </DetailSection>
      )}
    </div>
  );
}
