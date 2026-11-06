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
  HardDrive,
  MapPin,
  MemoryStick,
  Server,
  WalletCards,
  Waves,
  type LucideIcon,
} from "lucide-react";

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
  mobileValue?: React.ReactNode;
  detail?: React.ReactNode;
  icon: LucideIcon;
};

type DashboardOverviewPanelProps = {
  heroes: OverviewHeroMetric[];
  stats: OverviewStatMetric[];
  showHeroes: boolean;
  showStats: boolean;
  showNodeMap: boolean;
  nodeMapLabel: string;
  onOpenNodeMap: () => void;
};

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
      preserveAspectRatio="none"
      className="km-overview-sparkline"
      aria-hidden
    >
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
  index,
  onOpenNodeMap,
  nodeMapLabel,
}: {
  metric: OverviewHeroMetric;
  index: number;
  onOpenNodeMap?: () => void;
  nodeMapLabel: string;
}) {
  const value = (
    <>
      <span className="km-overview-number">{metric.value}</span>
      {metric.suffix ? (
        <span className="km-overview-unit">{metric.suffix}</span>
      ) : null}
    </>
  );
  return (
    <div className={`km-overview-hero km-overview-hero-${index}`}>
      <div className="km-overview-reading">
        <span className="km-overview-label">{metric.label}</span>
        {onOpenNodeMap ? (
          <button
            type="button"
            className="km-overview-value hover:text-zen-accent"
            onClick={onOpenNodeMap}
            aria-label={`${metric.label}: ${metric.value} ${metric.suffix ?? ""}. ${nodeMapLabel}`}
            title={nodeMapLabel}
          >
            {value}
          </button>
        ) : (
          <div className="km-overview-value" title={metric.caption}>
            {value}
          </div>
        )}
      </div>
      {metric.chartValues ? (
        <div className="km-overview-trend">
          <span className="km-overview-label km-overview-trend-label">
            {metric.caption}
          </span>
          <MetricSparkline values={metric.chartValues} />
        </div>
      ) : null}
    </div>
  );
}

function StatMetric({ metric }: { metric: OverviewStatMetric }) {
  return (
    <div className="km-overview-stat">
      <span className="km-overview-label">{metric.label}</span>
      <div className="km-overview-stat-value">
        <span className={metric.mobileValue ? "hidden lg:inline" : undefined}>
          {metric.value}
        </span>
        {metric.mobileValue ? (
          <span className="lg:hidden">{metric.mobileValue}</span>
        ) : null}
        {metric.detail ? (
          <span className="km-overview-stat-detail">{metric.detail}</span>
        ) : null}
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
}: DashboardOverviewPanelProps) {
  if (!showHeroes && !showStats) return null;

  return (
    <div className="km-overview">
      {showHeroes ? (
        <section className="km-overview-heroes">
          {heroes.map((metric, index) => (
            <React.Fragment key={metric.label}>
              <HeroMetric
                metric={metric}
                index={index}
                onOpenNodeMap={
                  index === 0 && showNodeMap ? onOpenNodeMap : undefined
                }
                nodeMapLabel={nodeMapLabel}
              />
            </React.Fragment>
          ))}
        </section>
      ) : null}

      {showStats ? (
        <section className="km-overview-stats">
          {stats.map((metric) => (
            <React.Fragment key={metric.label}>
              <StatMetric metric={metric} />
            </React.Fragment>
          ))}
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
