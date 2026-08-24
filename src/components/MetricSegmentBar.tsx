/**
 * Font-independent metric bars — fixed rem widths, CSS segments only.
 * @license SPDX-License-Identifier: MIT
 */

import React from "react";
import {
  METRIC_BAR_SEGMENTS,
  metricWidgetGridClass,
} from "@/lib/latencyDisplay";

const metricSegmentIndexes = Array.from(
  { length: METRIC_BAR_SEGMENTS },
  (_, i) => i,
);

type MetricPercentBarProps = {
  percent: number;
  valueClassName: string;
  fillClassName: string;
  textPrimaryClass: string;
};

export function MetricPercentBar({
  percent,
  valueClassName,
  fillClassName,
  textPrimaryClass,
}: MetricPercentBarProps) {
  const filled = Math.round(
    (Math.max(0, Math.min(100, percent)) / 100) * METRIC_BAR_SEGMENTS,
  );

  return (
    <span className={`${metricWidgetGridClass} ${textPrimaryClass}`}>
      <span className={`text-right font-bold tabular-nums ${valueClassName}`}>
        {percent.toFixed(1)}%
      </span>
      <MetricBarTrack filled={filled} fillClassName={fillClassName} />
    </span>
  );
}

type MetricBarTrackProps = {
  filled?: number;
  fillClassName?: string;
  segmentCount?: number;
  children?: React.ReactNode;
};

/** Bracketed segment track — border-x frame, no text characters. */
export function MetricBarTrack({
  filled = 0,
  fillClassName = "bg-zen-fg-strong",
  segmentCount = METRIC_BAR_SEGMENTS,
  children,
}: MetricBarTrackProps) {
  if (children) {
    return (
      <span
        className="inline-flex h-2.5 w-full items-stretch border-x border-zen-fg-faint/35 px-[2px] box-border"
        aria-hidden
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-2.5 w-full items-stretch border-x border-zen-fg-faint/35 px-[2px] box-border"
      aria-hidden
    >
      <span
        className="grid h-full w-full gap-px"
        style={{
          gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))`,
        }}
      >
        {(segmentCount === METRIC_BAR_SEGMENTS
          ? metricSegmentIndexes
          : Array.from({ length: segmentCount }, (_, i) => i)
        ).map((i) => (
          <span
            key={i}
            className={`min-w-0 rounded-[0.5px] ${
              i < filled ? fillClassName : "bg-zen-fill-muted/55"
            }`}
          />
        ))}
      </span>
    </span>
  );
}
