import React from "react";
import type { TimeRange } from "@/hooks/usePingChartViewport";

export type ChartScrubConfig = {
  width: number;
  paddingX: number;
  chartWidth: number;
  dataLength: number;
  timestamps?: number[];
};

export type TimeChartScrubConfig = {
  width: number;
  paddingX: number;
  chartWidth: number;
  viewRange: TimeRange;
};

export function indexFromClientX(
  clientX: number,
  svgEl: SVGSVGElement,
  config: ChartScrubConfig,
): number {
  const { width, paddingX, chartWidth, dataLength } = config;
  if (dataLength <= 0) return 0;

  const svgRect = svgEl.getBoundingClientRect();
  const x = clientX - svgRect.left;
  const svgX = (x / svgRect.width) * width;
  const chartRatio = (svgX - paddingX) / chartWidth;
  const times = config.timestamps;
  if (
    times?.length === dataLength &&
    dataLength > 1 &&
    times.at(-1)! > times[0]
  ) {
    const time =
      times[0] +
      Math.max(0, Math.min(1, chartRatio)) * (times.at(-1)! - times[0]);
    let lo = 0,
      hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (times[mid] < time) lo = mid + 1;
      else hi = mid;
    }
    return lo > 0 && time - times[lo - 1] <= times[lo] - time ? lo - 1 : lo;
  }
  return Math.max(
    0,
    Math.min(dataLength - 1, Math.round(chartRatio * (dataLength - 1))),
  );
}

export function useChartScrub(
  containerRef: React.RefObject<HTMLElement | null>,
  config: ChartScrubConfig,
) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const updateFromClientX = React.useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container || config.dataLength === 0) return;
      const svgEl = container.querySelector("svg");
      if (!svgEl) return;
      const nextIndex = indexFromClientX(clientX, svgEl, config);
      setHoveredIndex((prev) => (prev === nextIndex ? prev : nextIndex));
    },
    [containerRef, config],
  );

  const onMouseMove = React.useCallback(
    (e: React.MouseEvent) => updateFromClientX(e.clientX),
    [updateFromClientX],
  );

  const onMouseLeave = React.useCallback(() => setHoveredIndex(null), []);

  const onTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      if (e.touches[0]) updateFromClientX(e.touches[0].clientX);
    },
    [updateFromClientX],
  );

  const onTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (e.touches[0]) updateFromClientX(e.touches[0].clientX);
    },
    [updateFromClientX],
  );

  const onTouchEnd = React.useCallback(() => setHoveredIndex(null), []);

  return {
    hoveredIndex,
    setHoveredIndex,
    onMouseMove,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

export function timeFromClientX(
  clientX: number,
  svgEl: SVGSVGElement,
  config: TimeChartScrubConfig,
): number {
  const { width, paddingX, chartWidth, viewRange } = config;
  const [start, end] = viewRange;
  const span = Math.max(1, end - start);

  const svgRect = svgEl.getBoundingClientRect();
  const x = clientX - svgRect.left;
  const svgX = (x / svgRect.width) * width;
  const ratio = (svgX - paddingX) / chartWidth;
  const clamped = Math.max(0, Math.min(1, ratio));
  return start + clamped * span;
}

export function useTimeChartScrub(
  containerRef: React.RefObject<HTMLElement | null>,
  config: TimeChartScrubConfig | null,
) {
  const [hoveredTime, setHoveredTime] = React.useState<number | null>(null);

  const frame = React.useRef<number | null>(null);
  const pendingTime = React.useRef<number | null>(null);
  React.useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const clearHover = React.useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setHoveredTime(null);
  }, []);
  React.useEffect(clearHover, [config, clearHover]);
  const updateFromClientX = React.useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container || !config) return;
      const svgEl = container.querySelector("svg[data-chart-main]");
      if (!svgEl || !(svgEl instanceof SVGSVGElement)) return;
      const nextTime = timeFromClientX(clientX, svgEl, config);
      pendingTime.current = nextTime;
      if (frame.current == null)
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          setHoveredTime(pendingTime.current);
        });
    },
    [containerRef, config],
  );

  const onMouseMove = React.useCallback(
    (e: React.MouseEvent) => updateFromClientX(e.clientX),
    [updateFromClientX],
  );

  const onMouseLeave = clearHover;

  const onTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      if (e.touches[0]) updateFromClientX(e.touches[0].clientX);
    },
    [updateFromClientX],
  );

  const onTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (e.touches[0]) updateFromClientX(e.touches[0].clientX);
    },
    [updateFromClientX],
  );

  const onTouchEnd = clearHover;

  return {
    hoveredTime,
    setHoveredTime,
    onMouseMove,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
