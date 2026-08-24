import React from "react";
import type { TimeRange } from "@/hooks/usePingChartViewport";

export type ChartScrubConfig = {
  width: number;
  paddingX: number;
  chartWidth: number;
  dataLength: number;
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

  const updateFromClientX = React.useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container || !config) return;
      const svgEl = container.querySelector("svg[data-chart-main]");
      if (!svgEl || !(svgEl instanceof SVGSVGElement)) return;
      const nextTime = timeFromClientX(clientX, svgEl, config);
      setHoveredTime((prev) =>
        prev !== null && Math.abs(prev - nextTime) < 1 ? prev : nextTime,
      );
    },
    [containerRef, config],
  );

  const onMouseMove = React.useCallback(
    (e: React.MouseEvent) => updateFromClientX(e.clientX),
    [updateFromClientX],
  );

  const onMouseLeave = React.useCallback(() => setHoveredTime(null), []);

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

  const onTouchEnd = React.useCallback(() => setHoveredTime(null), []);

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
