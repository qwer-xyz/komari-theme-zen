/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import {
  ArrowDown,
  ArrowUp,
  Cpu,
  Gauge,
  Globe,
  HardDrive,
  MapPin,
  MemoryStick,
  RadioTower,
  Server,
  WalletCards,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { zenMotion } from "@/lib/zenMotion";
import { zenText } from "@/lib/zenSemantics";
import { zenType } from "@/lib/typography";

export type OverviewHeroMetric = {
  label: string;
  value: string;
  suffix?: string;
  caption: string;
  icon: LucideIcon;
  chartValues?: (number | null)[];
};

export type OverviewStatMetric = {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
};

export type OverviewNetworkHealth = {
  label: string;
  status: string;
  tone: "stable" | "warning" | "danger" | "quiet";
  metrics: Array<{
    label: string;
    value: string;
    detail?: string;
  }>;
};

type DashboardOverviewPanelProps = {
  heroes: OverviewHeroMetric[];
  stats: OverviewStatMetric[];
  showHeroes: boolean;
  showStats: boolean;
  showNodeMap: boolean;
  nodeMapLabel: string;
  onOpenNodeMap: () => void;
  networkHealth?: OverviewNetworkHealth;
};

function MetricIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-zen-line bg-zen-elevate/55 text-zen-accent shadow-[inset_0_1px_0_var(--zen-elevate)] @xl:size-10 @7xl:size-12">
      <Icon className="size-5 @7xl:size-[22px]" strokeWidth={1.8} aria-hidden />
    </span>
  );
}

function MetricSparkline({ values }: { values?: (number | null)[] }) {
  if (!values?.length) return null;

  const finiteValues = values.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  if (!finiteValues.length) return null;

  const max = Math.max(...finiteValues, 1);
  const width = 112;
  const height = 42;
  const projected = values.map((value, index) => {
    if (value == null || !Number.isFinite(value)) return null;
    const x =
      values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - 3 - (Math.max(0, value) / max) * (height - 8);
    return { x, y };
  });
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let segment: Array<{ x: number; y: number }> = [];
  for (const point of projected) {
    if (point) {
      segment.push(point);
    } else if (segment.length) {
      segments.push(segment);
      segment = [];
    }
  }
  if (segment.length) segments.push(segment);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-8 w-full min-w-0 overflow-visible text-zen-accent @5xl:h-10"
      aria-hidden
    >
      <line
        x1="0"
        y1={height - 2}
        x2={width}
        y2={height - 2}
        stroke="currentColor"
        strokeOpacity="0.14"
      />
      {segments.map((points, index) =>
        points.length > 1 ? (
          <polyline
            key={index}
            points={points
              .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
              .join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <circle
            key={index}
            cx={points[0].x}
            cy={points[0].y}
            r="1.8"
            fill="currentColor"
          />
        ),
      )}
    </svg>
  );
}

function HeroMetric({
  metric,
  action,
}: {
  metric: OverviewHeroMetric;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-4 px-5 py-5 @xl:min-h-40 @xl:gap-3 @xl:px-4 @xl:py-5 @5xl:min-h-44 @5xl:px-5 @7xl:gap-5 @7xl:px-8 @7xl:py-6">
      <MetricIcon icon={metric.icon} />
      <div className="flex min-w-0 flex-col justify-center">
        <span
          className={`${zenType.label} ${zenText.muted} mb-2 min-w-0 font-mono uppercase leading-tight zen-track-tight`}
          title={metric.label}
        >
          {metric.label}
        </span>
        <div className="grid min-w-0 grid-cols-[minmax(0,auto)_minmax(4.5rem,7rem)] items-center gap-3 @xl:grid-cols-1 @xl:gap-1.5 @5xl:grid-cols-[minmax(0,auto)_minmax(4.5rem,7rem)] @5xl:gap-3">
          <div className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[2.5rem] font-black leading-none text-zen-fg-strong @xl:text-[2.25rem] @5xl:text-[2.75rem] @7xl:text-[3.5rem]">
              {metric.value}
            </span>
            {metric.suffix ? (
              <span className="shrink-0 font-mono text-sm font-bold text-zen-fg-muted @xl:text-xs @5xl:text-base @7xl:text-xl">
                {metric.suffix}
              </span>
            ) : null}
          </div>
          <MetricSparkline values={metric.chartValues} />
        </div>
        <span
          className={`${zenType.caption} ${zenText.muted} mt-2 block min-w-0 font-mono leading-tight normal-case`}
          title={metric.caption}
        >
          {metric.caption}
        </span>
      </div>
      {action ? (
        <div className="absolute bottom-5 right-5 @xl:bottom-4 @xl:right-4 @5xl:bottom-5 @5xl:right-5 @7xl:bottom-6 @7xl:right-8">
          {action}
        </div>
      ) : null}
    </div>
  );
}

function StatMetric({ metric }: { metric: OverviewStatMetric }) {
  const Icon = metric.icon;
  return (
    <div className="grid min-h-[4.5rem] min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 px-3 py-3 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-3 sm:px-5 sm:py-3.5">
      <span className="inline-flex size-7 items-center justify-center rounded-md border border-zen-line bg-zen-elevate/45 text-zen-accent sm:size-9">
        <Icon className="size-3.5 sm:size-[17px]" strokeWidth={1.8} aria-hidden />
      </span>
      <div className="min-w-0 font-mono">
        <span className={`${zenType.label} ${zenText.muted} block leading-tight normal-case`} title={metric.label}>
          {metric.label}
        </span>
        <div className="mt-1 min-w-0 break-words text-[0.6875rem] font-bold leading-tight text-zen-fg-strong sm:text-[0.8125rem]">
          {metric.value}
        </div>
      </div>
    </div>
  );
}

function NetworkHealthRail({ health }: { health: OverviewNetworkHealth }) {
  const toneClass = {
    stable: "text-zen-success",
    warning: "text-zen-warning",
    danger: "text-zen-danger",
    quiet: "text-zen-fg-subtle",
  }[health.tone];

  return (
    <div className="bg-zen-elevate/25 px-5 py-4 shadow-[inset_0_10px_24px_-28px_var(--zen-fg)] @xl:px-6 @xl:py-4 @7xl:px-8">
      <div className="grid min-w-0 grid-cols-3 gap-x-3 gap-y-3 @xl:grid-cols-[minmax(10rem,1.05fr)_repeat(3,minmax(0,1fr))] @xl:items-center @xl:gap-x-8">
        <div className="col-span-3 flex min-w-0 items-center justify-between gap-3 @xl:col-span-1 @xl:justify-start">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-zen-fill-muted/25 ${toneClass}`}>
              <RadioTower className="size-4" strokeWidth={1.8} aria-hidden />
            </span>
            <span className={`${zenType.label} ${zenText.muted} truncate font-mono uppercase zen-track-tight`}>
              {health.label}
            </span>
          </div>
          <span className={`${zenType.caption} ${toneClass} inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono font-bold`}>
            <span className="size-1.5 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_12%,transparent)]" aria-hidden />
            {health.status}
          </span>
        </div>
        {health.metrics.slice(0, 3).map((metric, index) => (
          <div
            key={metric.label}
            className={`min-w-0 font-mono ${
              index === 1
                ? "text-center @xl:text-left"
                : index === 2
                  ? "text-right @xl:text-left"
                  : "text-left"
            }`}
          >
            <span className={`${zenType.micro} ${zenText.subtle} block truncate uppercase`} title={metric.label}>
              {metric.label}
            </span>
            <span className="mt-1 block whitespace-nowrap text-sm font-extrabold leading-none tabular-nums text-zen-fg-strong @xl:text-base">
              {metric.value}
            </span>
            {metric.detail ? (
              <span className={`${zenType.micro} ${zenText.faint} mt-1.5 hidden truncate normal-case @xl:block`} title={metric.detail}>
                {metric.detail}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardOverviewPanel({
  heroes,
  stats,
  showHeroes,
  showStats,
  showNodeMap,
  nodeMapLabel,
  onOpenNodeMap,
  networkHealth,
}: DashboardOverviewPanelProps) {
  if (!showHeroes && !showStats) return null;

  return (
    <div className="space-y-4 pt-5 @3xl:pt-7">
      {showHeroes ? (
        <section className="overflow-hidden rounded-xl border border-zen-line bg-zen-surface/75 shadow-[0_10px_30px_rgba(38,35,28,0.06)] backdrop-blur-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
          <div className="grid grid-cols-1 divide-y divide-zen-line @xl:grid-cols-3 @xl:divide-x @xl:divide-y-0">
            {heroes.map((metric, index) => (
              <React.Fragment key={metric.label}>
                <HeroMetric
                  metric={metric}
                  action={
                    index === 0 && showNodeMap ? (
                      <button
                        type="button"
                        onClick={onOpenNodeMap}
                        aria-label={nodeMapLabel}
                        title={nodeMapLabel}
                        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-zen-line bg-zen-elevate/35 text-zen-fg-muted hover:border-zen-accent/50 hover:text-zen-accent ${zenMotion.pop}`}
                      >
                        <Globe size={16} strokeWidth={1.8} aria-hidden />
                      </button>
                    ) : null
                  }
                />
              </React.Fragment>
            ))}
          </div>
          {networkHealth ? <NetworkHealthRail health={networkHealth} /> : null}
        </section>
      ) : null}

      {showStats ? (
        <section className="overflow-hidden rounded-xl border border-zen-line bg-zen-surface/65 shadow-[0_8px_24px_rgba(38,35,28,0.045)] backdrop-blur-sm dark:shadow-[0_10px_28px_rgba(0,0,0,0.14)]">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {stats.map((metric, index) => (
              <div
                key={metric.label}
                className={`${index % 2 ? "border-l border-zen-line" : ""} ${
                  index >= 2 ? "border-t border-zen-line" : ""
                } ${
                  index % 4 ? "md:border-l md:border-zen-line" : "md:border-l-0"
                } ${index >= 4 ? "md:border-t md:border-zen-line" : "md:border-t-0"}`}
              >
                <StatMetric metric={metric} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export const overviewIcons = {
  nodeStatus: Server,
  cpu: Cpu,
  bandwidth: Gauge,
  residual: WalletCards,
  regions: MapPin,
  cores: Cpu,
  memory: MemoryStick,
  disk: HardDrive,
  traffic: Waves,
  rx: ArrowDown,
  tx: ArrowUp,
} as const;
