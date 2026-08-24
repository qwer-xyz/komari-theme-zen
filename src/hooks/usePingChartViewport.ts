import React from "react";
import { computeRecordsTimeRange } from "@/lib/pingChartSeries";
import type { PingRecord } from "@/types/records";

export type TimeRange = [number, number];

const MIN_VIEW_SPAN_MS = 60_000;

function clampViewRange(
  range: TimeRange,
  fullRange: TimeRange,
): TimeRange {
  const [fullStart, fullEnd] = fullRange;
  let [start, end] = range;
  const span = Math.max(MIN_VIEW_SPAN_MS, end - start);
  start = Math.max(fullStart, Math.min(start, fullEnd - span));
  end = start + span;
  if (end > fullEnd) {
    end = fullEnd;
    start = Math.max(fullStart, end - span);
  }
  return [start, end];
}

export function usePingChartViewport(
  records: PingRecord[],
  resetKey: string,
) {
  const fullRange = React.useMemo(
    () => computeRecordsTimeRange(records),
    [records],
  );

  const [viewRange, setViewRangeState] = React.useState<TimeRange | null>(null);

  React.useEffect(() => {
    setViewRangeState(fullRange);
  }, [fullRange, resetKey]);

  const effectiveViewRange = viewRange ?? fullRange;

  const setViewRange = React.useCallback(
    (range: TimeRange) => {
      if (!fullRange) return;
      setViewRangeState(clampViewRange(range, fullRange));
    },
    [fullRange],
  );

  const resetZoom = React.useCallback(() => {
    if (fullRange) setViewRangeState(fullRange);
  }, [fullRange]);

  const zoomToSelection = React.useCallback(
    (start: number, end: number) => {
      if (!fullRange) return;
      if (end <= start) return;
      setViewRange([start, end]);
    },
    [fullRange, setViewRange],
  );

  const isZoomed = React.useMemo(() => {
    if (!fullRange || !effectiveViewRange) return false;
    return (
      effectiveViewRange[0] > fullRange[0] + 1 ||
      effectiveViewRange[1] < fullRange[1] - 1
    );
  }, [fullRange, effectiveViewRange]);

  return {
    fullRange,
    viewRange: effectiveViewRange,
    setViewRange,
    resetZoom,
    zoomToSelection,
    isZoomed,
  };
}
