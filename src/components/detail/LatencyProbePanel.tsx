import React from "react";
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
import { zenType, zenTouch } from "@/lib/typography";
import { zenFill, zenPopover, zenText } from "@/lib/zenSemantics";
import { PingChartOverview } from "@/components/detail/PingChartOverview";
import type { PingTaskInfo } from "@/types/records";

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

function valueToY(
  val: number,
  maxVal: number,
  height: number,
  paddingY: number,
  chartHeight: number,
): number {
  return height - paddingY - (Math.max(0, Math.min(maxVal, val)) / maxVal) * chartHeight;
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
}

export function LatencyProbePanel({
  uuid,
  hours,
  onLoadingChange,
  selectedProbes,
  onToggleProbe,
  lang,
  theme,
}: LatencyProbePanelProps) {
  const t = translations[lang];
  const [peakClipping, setPeakClipping] = React.useState(false);
  const [connectBreakpoints, setConnectBreakpoints] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(1000);

  const { data, isLoading } = usePingRecords(uuid, hours);

  React.useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width || 1000);
    return () => ro.disconnect();
  }, []);

  const tasks: PingTaskInfo[] = data?.tasks ?? [];
  const records = data?.records ?? [];

  const { fullRange, viewRange, setViewRange, resetZoom, isZoomed } =
    usePingChartViewport(records, `${uuid}:${hours}`);

  const rawSeriesByTask = React.useMemo(
    () => buildAllProbeSeries(records, tasks),
    [records, tasks],
  );

  const activeProbeIds =
    selectedProbes.length > 0
      ? selectedProbes
      : tasks.map((task) => String(task.id));

  const activeProbesList = tasks.filter((task) =>
    activeProbeIds.includes(String(task.id)),
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
  }, [tasks, rawSeriesByTask, viewRange, peakClipping, maxPoints, connectBreakpoints]);

  const gapBreakByTask = React.useMemo(() => {
    if (!viewRange) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const task of tasks) {
      const id = String(task.id);
      const points = filterPointsToRange(rawSeriesByTask[id] ?? [], viewRange);
      map[id] = gapBreakMsForSeries(points, task);
    }
    return map;
  }, [tasks, rawSeriesByTask, viewRange]);

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
    return max;
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

  const width = 1000;
  const height = 240;
  const paddingX = 24;
  const paddingY = 24;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const scrubConfig = React.useMemo(
    () =>
      viewRange
        ? { width, paddingX, chartWidth, viewRange }
        : null,
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

  const activeTime =
    hoveredTime ??
    (viewRange ? viewRange[1] : null);

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
      const raw = filterPointsToRange(rawSeriesByTask[id] ?? [], viewRange);
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
        const raw = filterPointsToRange(rawSeriesByTask[id] ?? [], viewRange);
        const gapBreak = gapBreakByTask[id] ?? gapBreakMsForSeries(raw, task);
        if (gapContainingTime(raw, gapBreak, activeTime)) return null;
        const val = valueAtTime(raw, activeTime, gapBreak / 4);
        if (val == null || !Number.isFinite(val)) return null;
        return { task, id, val, color: taskColor(idx) };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => a.val - b.val);

    return { probeSnapshot: rows, gapHint };
  }, [activeProbesList, rawSeriesByTask, activeTime, viewRange, gapBreakByTask, t]);

  const focusY = React.useMemo(() => {
    let y = height - paddingY;
    for (const row of probeSnapshot) {
      const pointY = valueToY(row.val, maxLatencyVal, height, paddingY, chartHeight);
      y = Math.min(y, pointY);
    }
    return y;
  }, [probeSnapshot, maxLatencyVal, chartHeight]);

  const crosshairRatio = activeX / width;
  const tooltipOnLeft = crosshairRatio > 0.55;

  const formatProbeMs = (val: number) =>
    `${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ms`;

  const strokeColor =
    theme === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
  const labelColor = `${zenText.subtle} font-mono`;

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

  const canRenderChart = fullRange != null && viewRange != null;

  if (tasks.length === 0 && !isLoading) {
    return (
      <div
        className={`py-12 text-center ${zenType.data} uppercase tracking-widest font-mono ${zenText.faint}`}
      >
        {t.pingNoTasks}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative py-4 px-4 -mx-4 flex flex-col space-y-4 bg-transparent overflow-visible">
        <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-2 select-none w-full">
          <span
            className={`font-extrabold tracking-wider uppercase ${zenType.body} ${zenText.primary} font-mono shrink-0`}
          >
            {t.pingLatencyDetection}
          </span>
          <div
            className={`flex flex-wrap items-center justify-end gap-x-3.5 gap-y-1 ${zenType.caption} font-mono select-none font-bold shrink-0`}
          >
            {isZoomed ? (
              <button
                type="button"
                onClick={resetZoom}
                className={`${zenTouch.btn} ${zenText.subtle} hover:text-zen-accent transition-colors font-semibold`}
              >
                {t.pingResetZoom}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPeakClipping(!peakClipping)}
              className={`${zenTouch.btn} transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                peakClipping
                  ? "text-zen-accent font-extrabold"
                  : `${zenText.faint} font-semibold hover:text-zen-fg-strong`
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${peakClipping ? "bg-zen-accent animate-pulse" : zenFill.track}`}
              />
              <span>{t.pingSmooth}</span>
            </button>
            <button
              type="button"
              onClick={() => setConnectBreakpoints(!connectBreakpoints)}
              className={`${zenTouch.btn} transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                connectBreakpoints
                  ? "text-zen-accent font-extrabold"
                  : `${zenText.faint} font-semibold hover:text-zen-fg-strong`
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${connectBreakpoints ? "bg-zen-accent animate-pulse" : zenFill.track}`}
              />
              <span>{t.pingConnectBreakpoints}</span>
            </button>
            <span className={zenText.subtle}>
              {formatMsg(t.pingActiveProbes, { count: activeProbesList.length })}
            </span>
          </div>
        </div>

        {canRenderChart ? (
          <>
            <div
              ref={containerRef}
              onMouseMove={isLoading ? undefined : onMouseMove}
              onMouseLeave={isLoading ? undefined : onMouseLeave}
              onTouchStart={isLoading ? undefined : onTouchStart}
              onTouchMove={isLoading ? undefined : onTouchMove}
              onTouchEnd={isLoading ? undefined : onTouchEnd}
              className={`relative overflow-visible touch-none ${isLoading ? "pointer-events-none" : "cursor-crosshair"}`}
            >
              <svg
                data-chart-main
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                className="w-full h-52 sm:h-56 md:h-60 overflow-visible"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                  <line
                    key={i}
                    x1={paddingX}
                    y1={paddingY + r * chartHeight}
                    x2={width - paddingX}
                    y2={paddingY + r * chartHeight}
                    stroke={strokeColor}
                    strokeDasharray="2 2"
                    strokeWidth={1}
                  />
                ))}

                {activeProbesList.map((task, idx) => {
                  const id = String(task.id);
                  const plan = chartPlanByTask[id];
                  if (!plan) return null;
                  const { solidSegments, bridgeSegments } = plan;
                  const color = taskColor(idx);
                  const selected = selectedProbes.includes(id);
                  const dimmed = selectedProbes.length > 0 && !selected;
                  const opacity =
                    dimmed ? 0.38 : selectedProbes.length === 0 ? 0.85 : 1;

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
                })}

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
                    const y = valueToY(val, maxLatencyVal, height, paddingY, chartHeight);
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
                      <div key={id} className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span
                          className={`min-w-0 flex-1 truncate normal-case ${zenText.secondary}`}
                        >
                          {task.name}
                        </span>
                        <span
                          className="shrink-0 font-bold tabular-nums"
                          style={{ color }}
                        >
                          {formatProbeMs(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                className={`absolute top-0.5 left-1 ${zenType.micro} leading-none ${labelColor} pointer-events-none select-none`}
              >
                MAX: {maxLatencyVal.toFixed(0)} ms
              </div>
              <div
                className={`absolute bottom-0.5 left-1 ${zenType.micro} leading-none ${labelColor} pointer-events-none select-none`}
              >
                MIN: 0 ms
              </div>

              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-6 pointer-events-none">
                {xAxisLabels.map(({ ratio, label }) => (
                  <span
                    key={ratio}
                    className={`${zenType.micro} ${zenText.faint} font-mono tabular-nums`}
                    style={{
                      position: "absolute",
                      left: `${((paddingX + ratio * chartWidth) / width) * 100}%`,
                      transform: "translateX(-50%)",
                      bottom: "-1.1rem",
                    }}
                  >
                    {label}
                  </span>
                ))}
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
            />

            <div className="space-y-2 pt-1 select-none">
              <div
                className={`${zenType.label} zen-track-tight uppercase font-bold font-mono ${zenText.subtle}`}
              >
                {t.pingProbeFilter}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 sm:gap-x-6 gap-y-2.5 pt-1.5 font-mono">
                {tasks.map((task, idx) => {
                  const id = String(task.id);
                  const color = taskColor(idx);
                  const isSelected = selectedProbes.includes(id);
                  const isChartActive =
                    selectedProbes.length === 0 || isSelected;
                  const avg = task.avg ?? task.latest ?? 0;
                  const lossVal = task.loss ?? 0;
                  const volatility = taskPingVolatility(
                    task,
                    rawValuesByTask[id],
                  );

                  const metricsTitle = `${avg >= 100 ? avg.toFixed(0) : avg.toFixed(1)}ms · ${lossVal.toFixed(1)}%${
                    volatility !== null ? ` · ${volatility.toFixed(2)}` : ""
                  }`;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onToggleProbe(id)}
                      title={`${task.name} — ${metricsTitle}`}
                      className={`flex items-center gap-1.5 min-w-0 w-full ${zenTouch.btn} transition-all duration-200 cursor-pointer rounded-md ${
                        isSelected
                          ? "text-zen-accent font-extrabold border border-zen-accent/55 bg-zen-accent/12 dark:bg-zen-accent/18 px-2 py-1 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                          : isChartActive
                            ? `${zenText.primary} bg-transparent px-1 hover:bg-zen-fill-muted/8`
                            : `${zenText.muted} px-1 hover:text-zen-fg-strong hover:bg-zen-fill-muted/8`
                      } ${zenType.caption}`}
                    >
                      <span
                        className={`rounded-full shrink-0 transition-all duration-200 ${
                          isSelected ? "w-1.5 h-1.5 ring-2 ring-zen-accent/40" : "w-1 h-1"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                      <span
                        className={`shrink-0 whitespace-nowrap text-left font-sans ${zenType.caption} ${
                          isSelected ? "font-bold" : "font-medium"
                        }`}
                      >
                        {task.name}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-right font-mono tabular-nums ${
                          isSelected ? "font-extrabold" : isChartActive ? "font-bold" : ""
                        }`}
                      >
                        <span style={{ color: isChartActive ? color : undefined }}>
                          {avg >= 100 ? avg.toFixed(0) : avg.toFixed(1)}ms
                        </span>
                        <span
                          className={`${lossVal > 0 ? "text-zen-warning" : zenText.subtle}`}
                        >
                          {" · "}
                          {lossVal.toFixed(1)}%
                        </span>
                        {volatility !== null ? (
                          <span
                            className={
                              volatility > 0.3 ? "text-zen-warning" : zenText.subtle
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
                  className={`font-bold tracking-wider underline cursor-pointer hover:text-zen-accent transition-colors uppercase ${zenType.label}`}
                >
                  {t.pingShowAll}
                </button>
              )}
            </div>
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
