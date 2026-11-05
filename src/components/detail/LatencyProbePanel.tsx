import { HistoryError } from "@/components/SectionErrorBoundary";
import React from "react";
import { Wifi } from "lucide-react";
import { usePingRecords } from "@/hooks/usePingRecords";
import { useTimeChartScrub } from "@/hooks/useChartScrub";
import { usePingChartViewport } from "@/hooks/usePingChartViewport";
import {
  buildAllProbeSeries,
  buildOverviewEnvelope,
  buildProbeDrawPlan,
  despikePingSeries,
  filterPointsToRange,
  formatPingGapDuration,
  gapBreakMsForSeries,
  gapContainingTime,
  maxLatencyInPoints,
  type PingPoint,
  type ProbeDrawPlan,
  valueAtTime,
} from "@/lib/pingChartSeries";
import { formatMsg, translations, type Lang } from "@/lib/i18n";
import { formatChartPointTime } from "@/lib/timeRangePresets";
import { taskColor, taskPingVolatility } from "@/lib/recordTransform";
import { zenType } from "@/lib/typography";
import { zenPopover, zenText } from "@/lib/zenSemantics";
import { PingChartOverview } from "@/components/detail/PingChartOverview";
import type { PingRecord, PingTaskInfo } from "@/types/records";

const EMPTY_TASKS: PingTaskInfo[] = [];
const EMPTY_RECORDS: PingRecord[] = [];
const EMPTY_IDS: number[] = [];

type ProbeChartPoint = { x: number; y: number; val: number };

function buildProbeLinePath(pts: ProbeChartPoint[]): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

function timeToX(
  t: number,
  viewRange: [number, number],
  paddingX: number,
  chartWidth: number,
): number {
  const [start, end] = viewRange;
  const span = Math.max(1, end - start);
  return paddingX + ((t - start) / span) * chartWidth;
}

function niceLatencyMax(value: number): number {
  if (value <= 30) return 30;
  if (value <= 60) return 60;
  if (value <= 90) return 90;
  if (value <= 120) return 120;
  if (value <= 200) return 200;
  if (value <= 300) return 300;
  if (value <= 500) return 500;
  const step = value <= 1000 ? 100 : 250;
  return Math.ceil(value / step) * step;
}

function valueToY(
  val: number,
  maxVal: number,
  height: number,
  paddingY: number,
  chartHeight: number,
): number {
  return (
    height -
    paddingY -
    (Math.max(0, Math.min(maxVal, val)) / maxVal) * chartHeight
  );
}

function GapEndpoint({
  x,
  y,
  color,
  opacity,
}: {
  x: number;
  y: number;
  color: string;
  opacity: number;
}) {
  return (
    <circle
      cx={x}
      cy={y}
      r={3.2}
      fill="var(--zen-bg)"
      stroke={color}
      strokeWidth={1.6}
      opacity={opacity}
    />
  );
}

interface LatencyProbePanelProps {
  uuid: string;
  hours: number;
  onLoadingChange?: (loading: boolean) => void;
  selectedProbes: string[];
  onToggleProbe: (id: string) => void;
  lang: Lang;
  theme: "light" | "dark";
  taskIds?: number[];
  title?: string;
  rangeSlot?: React.ReactNode;
}

export function LatencyProbePanel({
  uuid,
  hours,
  onLoadingChange,
  selectedProbes,
  onToggleProbe,
  lang,
  theme,
  taskIds = EMPTY_IDS,
  title,
  rangeSlot,
}: LatencyProbePanelProps) {
  const t = translations[lang];
  const [peakClipping, setPeakClipping] = React.useState(false);
  const [connectBreakpoints, setConnectBreakpoints] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(320);
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const bindContainer = React.useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
    setContainer(element);
  }, []);

  const { data, isLoading, error, retry } = usePingRecords(
    uuid,
    hours,
    taskIds,
  );

  React.useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  React.useEffect(() => {
    const el = container;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(Math.round(w));
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width || 1000);
    return () => ro.disconnect();
  }, [container]);

  const tasks: PingTaskInfo[] = data?.tasks ?? EMPTY_TASKS;
  const records = data?.records ?? EMPTY_RECORDS;

  const { fullRange, viewRange, setViewRange, resetZoom, isZoomed } =
    usePingChartViewport(records, `${uuid}:${hours}`);

  const rawSeriesByTask = React.useMemo(
    () => buildAllProbeSeries(records, tasks),
    [records, tasks],
  );

  const activeProbeIds = React.useMemo(
    () =>
      selectedProbes.length > 0
        ? selectedProbes
        : tasks.map((task) => String(task.id)),
    [selectedProbes, tasks],
  );
  const activeProbesList = React.useMemo(
    () => tasks.filter((task) => activeProbeIds.includes(String(task.id))),
    [tasks, activeProbeIds],
  );
  const colors = React.useMemo(
    () =>
      Object.fromEntries(
        tasks.map((task, index) => [String(task.id), taskColor(index)]),
      ),
    [tasks],
  );
  const visibleRaw = React.useMemo(
    () =>
      Object.fromEntries(
        tasks.map((task) => [
          String(task.id),
          viewRange
            ? filterPointsToRange(
                rawSeriesByTask[String(task.id)] ?? [],
                viewRange,
              )
            : [],
        ]),
      ),
    [tasks, rawSeriesByTask, viewRange],
  );

  const maxPoints = Math.max(60, Math.floor(containerWidth * 2));

  const chartPlanByTask = React.useMemo(() => {
    if (!viewRange) return {} as Record<string, ProbeDrawPlan>;
    const map: Record<string, ProbeDrawPlan> = {};
    for (const task of tasks) {
      const id = String(task.id);
      let points = rawSeriesByTask[id] ?? [];
      if (peakClipping && points.length > 0) {
        points = despikePingSeries(points);
      }
      points = filterPointsToRange(points, viewRange);
      map[id] = buildProbeDrawPlan(
        points,
        maxPoints,
        gapBreakMsForSeries(points, task),
        connectBreakpoints,
        "lttb",
      );
    }
    return map;
  }, [
    tasks,
    rawSeriesByTask,
    viewRange,
    peakClipping,
    maxPoints,
    connectBreakpoints,
  ]);

  const gapBreakByTask = React.useMemo(() => {
    if (!viewRange) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const task of tasks) {
      const id = String(task.id);
      const points = visibleRaw[id] ?? [];
      map[id] = gapBreakMsForSeries(points, task);
    }
    return map;
  }, [tasks, visibleRaw, viewRange]);

  const maxLatencyVal = React.useMemo(() => {
    let max = 50;
    for (const id of activeProbeIds) {
      const plan = chartPlanByTask[id];
      if (!plan) continue;
      max = Math.max(
        max,
        maxLatencyInPoints(plan.solidSegments, 50),
        maxLatencyInPoints(plan.bridgeSegments, 50),
      );
    }
    return niceLatencyMax(max);
  }, [activeProbeIds, chartPlanByTask]);

  const overviewEnvelope = React.useMemo(
    () => buildOverviewEnvelope(rawSeriesByTask, activeProbeIds, 200),
    [rawSeriesByTask, activeProbeIds],
  );

  const rawValuesByTask = React.useMemo(() => {
    const map: Record<string, number[]> = {};
    tasks.forEach((task) => {
      map[String(task.id)] = [];
    });
    for (const rec of records) {
      const key = String(rec.task_id);
      if (map[key] && typeof rec.value === "number" && rec.value > 0) {
        map[key].push(rec.value);
      }
    }
    return map;
  }, [tasks, records]);

  const volatilityByTask = React.useMemo(
    () =>
      Object.fromEntries(
        tasks.map((task) => [
          String(task.id),
          taskPingVolatility(task, rawValuesByTask[String(task.id)]),
        ]),
      ),
    [tasks, rawValuesByTask],
  );
  const width = 1000;
  const height = 240;
  const paddingX = 8;
  const paddingY = 8;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const scrubConfig = React.useMemo(
    () => (viewRange ? { width, paddingX, chartWidth, viewRange } : null),
    [chartWidth, viewRange],
  );

  const {
    hoveredTime,
    onMouseMove,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  } = useTimeChartScrub(containerRef, scrubConfig);

  const activeTime = hoveredTime ?? (viewRange ? viewRange[1] : null);

  const activeX =
    activeTime != null && viewRange
      ? timeToX(activeTime, viewRange, paddingX, chartWidth)
      : paddingX + chartWidth;

  const isHovering = hoveredTime !== null;

  const activeTimeLabel = React.useMemo(() => {
    if (activeTime == null) return "";
    return formatChartPointTime(new Date(activeTime).toISOString(), hours);
  }, [activeTime, hours]);

  const { probeSnapshot, gapHint } = React.useMemo(() => {
    if (activeTime == null || !viewRange) {
      return { probeSnapshot: [], gapHint: null as string | null };
    }

    let widestGap: { durationMs: number } | null = null;
    for (const task of activeProbesList) {
      const id = String(task.id);
      const raw = visibleRaw[id] ?? [];
      const gapBreak = gapBreakByTask[id] ?? gapBreakMsForSeries(raw, task);
      const gap = gapContainingTime(raw, gapBreak, activeTime);
      if (gap && (!widestGap || gap.durationMs > widestGap.durationMs)) {
        widestGap = gap;
      }
    }

    const gapHint =
      widestGap != null
        ? formatMsg(t.pingDataGap, {
            duration: formatPingGapDuration(widestGap.durationMs),
          })
        : null;

    const rows = activeProbesList
      .map((task, idx) => {
        const id = String(task.id);
        const raw = visibleRaw[id] ?? [];
        const gapBreak = gapBreakByTask[id] ?? gapBreakMsForSeries(raw, task);
        if (gapContainingTime(raw, gapBreak, activeTime)) return null;
        const val = valueAtTime(raw, activeTime, gapBreak / 4);
        if (val == null || !Number.isFinite(val)) return null;
        return { task, id, val, color: colors[id] };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => a.val - b.val);

    return { probeSnapshot: rows, gapHint };
  }, [
    activeProbesList,
    visibleRaw,
    activeTime,
    viewRange,
    gapBreakByTask,
    t,
    colors,
  ]);

  const focusY = React.useMemo(() => {
    let y = height - paddingY;
    for (const row of probeSnapshot) {
      const pointY = valueToY(
        row.val,
        maxLatencyVal,
        height,
        paddingY,
        chartHeight,
      );
      y = Math.min(y, pointY);
    }
    return y;
  }, [probeSnapshot, maxLatencyVal, chartHeight]);

  const crosshairRatio = activeX / width;
  const tooltipOnLeft = crosshairRatio > 0.55;

  const formatProbeMs = (val: number) =>
    `${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ms`;

  const strokeColor =
    theme === "dark" ? "rgba(250, 249, 245, 0.08)" : "rgba(48, 48, 46, 0.08)";

  const xAxisLabels = React.useMemo(() => {
    if (!viewRange) return [];
    const [start, end] = viewRange;
    return [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      ratio,
      label: formatChartPointTime(
        new Date(start + ratio * (end - start)).toISOString(),
        hours,
      ),
    }));
  }, [viewRange, hours]);

  const curves = React.useMemo(
    () =>
      viewRange
        ? activeProbesList.map((task, idx) => {
            const id = String(task.id);
            const plan = chartPlanByTask[id];
            if (!plan) return null;
            const { solidSegments, bridgeSegments } = plan;
            const color = colors[id];
            const selected = selectedProbes.includes(id);
            const dimmed = selectedProbes.length > 0 && !selected;
            const opacity = dimmed
              ? 0.38
              : selectedProbes.length === 0
                ? 0.85
                : 1;

            const toChartPoints = (segment: PingPoint[]) =>
              segment.map((p) => ({
                x: timeToX(p.t, viewRange, paddingX, chartWidth),
                y: valueToY(p.v, maxLatencyVal, height, paddingY, chartHeight),
                val: p.v,
              }));

            return (
              <g key={id}>
                {solidSegments.map((segment, segIdx) => {
                  const points = toChartPoints(segment);
                  const showGapCap = !connectBreakpoints;

                  if (points.length === 1) {
                    const capNeeded =
                      showGapCap &&
                      (segIdx > 0 || segIdx < solidSegments.length - 1);
                    return (
                      <React.Fragment key={`${id}-solid-${segIdx}`}>
                        {capNeeded ? (
                          <GapEndpoint
                            x={points[0].x}
                            y={points[0].y}
                            color={color}
                            opacity={opacity}
                          />
                        ) : null}
                        <circle
                          cx={points[0].x}
                          cy={points[0].y}
                          r={2.2}
                          fill={color}
                          opacity={opacity}
                        />
                      </React.Fragment>
                    );
                  }

                  const pathD = buildProbeLinePath(points);
                  if (!pathD) return null;
                  const lastPt = points[points.length - 1];
                  const firstPt = points[0];
                  return (
                    <React.Fragment key={`${id}-solid-${segIdx}`}>
                      {showGapCap && segIdx > 0 ? (
                        <GapEndpoint
                          x={firstPt.x}
                          y={firstPt.y}
                          color={color}
                          opacity={opacity}
                        />
                      ) : null}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={opacity}
                        className="transition-all duration-300"
                      />
                      {showGapCap && segIdx < solidSegments.length - 1 ? (
                        <GapEndpoint
                          x={lastPt.x}
                          y={lastPt.y}
                          color={color}
                          opacity={opacity}
                        />
                      ) : null}
                    </React.Fragment>
                  );
                })}

                {connectBreakpoints &&
                  bridgeSegments.map((bridge, bridgeIdx) => {
                    const points = toChartPoints(bridge);
                    const pathD = buildProbeLinePath(points);
                    if (!pathD) return null;
                    return (
                      <path
                        key={`${id}-bridge-${bridgeIdx}`}
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.4}
                        strokeLinecap="round"
                        strokeDasharray="5 4"
                        opacity={opacity * 0.72}
                        className="transition-all duration-300"
                      />
                    );
                  })}
              </g>
            );
          })
        : null,
    [
      activeProbesList,
      chartPlanByTask,
      colors,
      selectedProbes,
      viewRange,
      maxLatencyVal,
      connectBreakpoints,
    ],
  );
  const canRenderChart = fullRange != null && viewRange != null;

  if (error && tasks.length === 0)
    return <HistoryError lang={lang} retry={retry} loading={isLoading} />;

  if (tasks.length === 0 && !isLoading) {
    return (
      <div className="py-10 text-center text-sm text-zen-fg-muted">
        {t.pingNoTasks}
      </div>
    );
  }

  const chartTitle = title ?? t.pingLatencyDetection;
  const latencyTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) =>
    `${Math.round(maxLatencyVal * ratio)} ms`,
  );
  const toggleClass = (active: boolean) =>
    `inline-flex cursor-pointer items-center gap-1.5 text-sm ${
      active
        ? "font-medium text-zen-chip-fg"
        : "text-zen-fg-muted hover:text-zen-fg-strong"
    }`;

  return (
    <div className="space-y-3">
      {error && <HistoryError lang={lang} retry={retry} loading={isLoading} />}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Wifi
              className="h-4 w-4 text-zen-fg-muted"
              strokeWidth={1.75}
              aria-hidden
            />
            <h3 className="text-sm font-semibold leading-none text-zen-fg-strong">
              {chartTitle}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {rangeSlot}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {isZoomed ? (
                <button
                  type="button"
                  onClick={resetZoom}
                  className="cursor-pointer text-sm text-zen-fg-muted hover:text-zen-accent"
                >
                  {t.pingResetZoom}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPeakClipping(!peakClipping)}
                aria-pressed={peakClipping}
                className={toggleClass(peakClipping)}
              >
                {t.pingSmooth}
              </button>
              <button
                type="button"
                onClick={() => setConnectBreakpoints(!connectBreakpoints)}
                aria-pressed={connectBreakpoints}
                className={toggleClass(connectBreakpoints)}
              >
                {t.pingConnectBreakpoints}
              </button>
              <span className="text-sm text-zen-fg-muted">
                {formatMsg(t.pingActiveProbes, {
                  count: activeProbesList.length,
                })}
              </span>
            </div>
          </div>
        </div>

        {canRenderChart ? (
          <>
            <div className="flex items-baseline gap-2 text-xs text-zen-fg-muted">
              <span>{chartTitle}</span>
              <span className="tabular-nums">
                MAX: {maxLatencyVal.toFixed(0)} ms
              </span>
            </div>
            <div className="flex items-stretch gap-2">
              <div className="flex w-14 shrink-0 flex-col justify-between py-1 text-right text-[10px] leading-none tabular-nums text-zen-fg-faint">
                {latencyTicks.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            <div
              ref={bindContainer}
              onMouseMove={isLoading ? undefined : onMouseMove}
              onMouseLeave={isLoading ? undefined : onMouseLeave}
              onTouchStart={isLoading ? undefined : onTouchStart}
              onTouchMove={isLoading ? undefined : onTouchMove}
              onTouchEnd={isLoading ? undefined : onTouchEnd}
              className={`relative min-w-0 flex-1 overflow-visible pb-5 touch-pan-y ${isLoading ? "pointer-events-none" : "cursor-crosshair"}`}
            >
              <svg
                data-chart-main
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                className="h-48 w-full overflow-visible sm:h-56 md:h-64"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                  <line
                    key={i}
                    x1={paddingX}
                    y1={paddingY + r * chartHeight}
                    x2={width - paddingX}
                    y2={paddingY + r * chartHeight}
                    stroke={strokeColor}
                    strokeWidth={1}
                  />
                ))}

                {curves}

                {isHovering && (
                  <line
                    x1={activeX}
                    y1={paddingY}
                    x2={activeX}
                    y2={height - paddingY}
                    stroke={
                      theme === "dark"
                        ? "rgba(255, 255, 255, 0.15)"
                        : "rgba(0, 0, 0, 0.15)"
                    }
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                )}

                {isHovering &&
                  probeSnapshot.map(({ id, val, color }) => {
                    const y = valueToY(
                      val,
                      maxLatencyVal,
                      height,
                      paddingY,
                      chartHeight,
                    );
                    return (
                      <circle
                        key={`focus-${id}`}
                        cx={activeX}
                        cy={y}
                        r={4}
                        fill={color}
                      />
                    );
                  })}
              </svg>

              {isHovering && (probeSnapshot.length > 0 || gapHint) && (
                <div
                  className={`absolute z-10 min-w-[8.5rem] max-w-[min(11rem,calc(100vw-2.5rem))] rounded-md px-2.5 py-2 pointer-events-none ${zenType.caption} font-mono select-none ${zenPopover}`}
                  style={{
                    left: `${crosshairRatio * 100}%`,
                    top: `${(focusY / height) * 100}%`,
                    transform: tooltipOnLeft
                      ? "translate(calc(-100% - 10px), -0.5rem)"
                      : "translate(10px, -0.5rem)",
                  }}
                >
                  {activeTimeLabel ? (
                    <div
                      className={`mb-1.5 tabular-nums ${zenType.label} ${zenText.subtle}`}
                    >
                      {activeTimeLabel}
                    </div>
                  ) : null}
                  {gapHint ? (
                    <div
                      className={`mb-1.5 tabular-nums ${zenType.label} ${zenText.faint} italic`}
                    >
                      {gapHint}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    {probeSnapshot.map(({ task, id, val, color }) => (
                      <div
                        key={id}
                        className="flex items-center gap-1.5 min-w-0"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span
                          className={`min-w-0 flex-1 truncate normal-case ${zenText.secondary}`}
                        >
                          {task.name}
                        </span>
                        <span className="shrink-0 font-bold tabular-nums text-zen-fg-strong">
                          {formatProbeMs(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute bottom-0 left-0 right-0">
                {xAxisLabels.map(({ ratio, label }) => (
                  <span
                    key={ratio}
                    className="absolute text-[10px] tabular-nums text-zen-fg-faint"
                    style={{
                      left: `${((paddingX + ratio * chartWidth) / width) * 100}%`,
                      transform:
                        ratio <= 0
                          ? "translateX(0)"
                          : ratio >= 1
                            ? "translateX(-100%)"
                            : "translateX(-50%)",
                      bottom: 0,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            </div>

            <PingChartOverview
              fullRange={fullRange}
              viewRange={viewRange}
              envelope={overviewEnvelope}
              onViewRangeChange={setViewRange}
              onResetZoom={resetZoom}
              theme={theme}
              ariaLabel={t.pingOverviewAria}
              keyboardHelp={t.pingOverviewKeyboardHelp}
            />

            <div className="grid grid-cols-1 gap-y-2 pt-1 sm:grid-cols-2 lg:grid-cols-3">
                {tasks.map((task) => {
                  const id = String(task.id);
                  const color = colors[id];
                  const isSelected = selectedProbes.includes(id);
                  const isChartActive =
                    selectedProbes.length === 0 || isSelected;
                  const avg = task.avg ?? task.latest ?? 0;
                  const lossVal = task.loss ?? 0;
                  const volatility = volatilityByTask[id];
                  const msText = `${avg >= 100 ? avg.toFixed(0) : avg.toFixed(1)} ms`;
                  const metricsTitle = `${msText} · ${lossVal.toFixed(1)}%${
                    volatility !== null ? ` · ${volatility.toFixed(2)}` : ""
                  }`;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onToggleProbe(id)}
                      aria-pressed={isSelected}
                      title={`${task.name} — ${metricsTitle}`}
                      className={`flex min-w-0 items-center gap-2 py-0.5 text-left text-sm cursor-pointer ${
                        isChartActive
                          ? "text-zen-fg-strong"
                          : "text-zen-fg-faint"
                      }`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {task.name}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-semibold">{msText}</span>
                        <span
                          className={
                            lossVal > 0 ? "text-zen-warning" : "text-zen-fg-muted"
                          }
                        >
                          {" · "}
                          {lossVal.toFixed(1)}%
                        </span>
                        {volatility !== null ? (
                          <span
                            className={
                              volatility > 0.3
                                ? "text-zen-warning"
                                : "text-zen-fg-muted"
                            }
                            title={t.pingVolatility}
                          >
                            {" · "}
                            {volatility.toFixed(2)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedProbes.length > 0 && (
                <button
                  type="button"
                  onClick={() => onToggleProbe("CLEAR_ALL")}
                  className="cursor-pointer text-sm text-zen-fg-muted underline-offset-2 hover:text-zen-accent hover:underline"
                >
                  {t.pingShowAll}
                </button>
              )}
          </>
        ) : isLoading ? (
          <div className="space-y-4 pt-1" aria-hidden>
            <div className="h-52 sm:h-56 md:h-60 rounded-sm bg-zen-fill-muted/10" />
            <div className="h-11 rounded-sm bg-zen-fill-muted/8" />
            <div className="space-y-2 pt-1">
              <div className="h-3 w-36 rounded bg-zen-fill-muted/12" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2.5 pt-1.5">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="h-5 rounded bg-zen-fill-muted/8" />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
