/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import type { LiveRecord } from "@/types/LiveData";
import type { LoadRecord } from "@/types/records";
import { timestampMs } from "@/lib/numeric";

export type DashboardTrendSample = {
  t: number;
  cpu: number | null;
  bandwidth: number | null;
};

export type DashboardTrendSeries = {
  cpu: (number | null)[];
  bandwidth: (number | null)[];
};

type DashboardTrendOptions = {
  cpuMetric: "Average" | "Max";
  bandwidthMetric: "Total" | "Max";
  endMs?: number;
  rangeMs?: number;
  bucketCount?: number;
};

function finiteNumber(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function sumPair(a: unknown, b: unknown): number | null {
  const first = finiteNumber(a);
  const second = finiteNumber(b);
  if (first == null || second == null) return null;
  return Math.max(0, first) + Math.max(0, second);
}

export function loadRecordsToDashboardTrend(
  records: LoadRecord[],
): DashboardTrendSample[] {
  if (!Array.isArray(records)) return [];
  return records.flatMap((record) => {
    const t = timestampMs(record.time);
    if (t == null) return [];
    const cpu = finiteNumber(record.cpu);
    return [
      {
        t,
        cpu: cpu == null ? null : Math.max(0, cpu),
        bandwidth: sumPair(record.net_in, record.net_out),
      },
    ];
  });
}

export function recentRecordsToDashboardTrend(
  records: LiveRecord[],
): DashboardTrendSample[] {
  if (!Array.isArray(records)) return [];
  return records.flatMap((record) => {
    const t = timestampMs(record.updated_at);
    if (t == null) return [];
    const cpu = finiteNumber(record.cpu?.usage);
    return [
      {
        t,
        cpu: cpu == null ? null : Math.max(0, cpu),
        bandwidth: sumPair(record.network?.down, record.network?.up),
      },
    ];
  });
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function aggregateNodeBucket(
  samples: DashboardTrendSample[],
  metric: "cpu" | "bandwidth",
): number | null {
  const values = samples
    .map((sample) => sample[metric])
    .filter((value): value is number => value != null && Number.isFinite(value));
  return values.length ? average(values) : null;
}

/**
 * Align node histories to a shared timeline before aggregating. A bucket stays
 * null when no node reported that metric, so missing intervals render as gaps.
 */
export function aggregateDashboardTrends(
  histories: Map<string, DashboardTrendSample[]>,
  current: Map<string, DashboardTrendSample>,
  options: DashboardTrendOptions,
): DashboardTrendSeries {
  const endMs = options.endMs ?? Date.now();
  const rangeMs = options.rangeMs ?? 60 * 60 * 1000;
  const bucketCount = Math.max(2, options.bucketCount ?? 28);
  const startMs = endMs - rangeMs;
  const bucketMs = rangeMs / bucketCount;
  const nodeIds = new Set([...histories.keys(), ...current.keys()]);
  const perNodeBuckets = new Map<
    string,
    Array<DashboardTrendSample[]>
  >();

  for (const nodeId of nodeIds) {
    const buckets = Array.from(
      { length: bucketCount },
      () => [] as DashboardTrendSample[],
    );
    const samples = [...(histories.get(nodeId) ?? [])];
    const latest = current.get(nodeId);
    if (latest) samples.push(latest);

    for (const sample of samples) {
      if (sample.t < startMs || sample.t > endMs + 5000) continue;
      const index = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((sample.t - startMs) / bucketMs)),
      );
      buckets[index].push(sample);
    }
    perNodeBuckets.set(nodeId, buckets);
  }

  const cpu: (number | null)[] = [];
  const bandwidth: (number | null)[] = [];

  for (let index = 0; index < bucketCount; index++) {
    const cpuValues: number[] = [];
    const bandwidthValues: number[] = [];

    for (const buckets of perNodeBuckets.values()) {
      const nodeCpu = aggregateNodeBucket(buckets[index], "cpu");
      const nodeBandwidth = aggregateNodeBucket(
        buckets[index],
        "bandwidth",
      );
      if (nodeCpu != null) cpuValues.push(nodeCpu);
      if (nodeBandwidth != null) bandwidthValues.push(nodeBandwidth);
    }

    cpu.push(
      cpuValues.length
        ? options.cpuMetric === "Max"
          ? Math.max(...cpuValues)
          : average(cpuValues)
        : null,
    );
    bandwidth.push(
      bandwidthValues.length
        ? options.bandwidthMetric === "Max"
          ? Math.max(...bandwidthValues)
          : bandwidthValues.reduce((sum, value) => sum + value, 0)
        : null,
    );
  }

  return { cpu, bandwidth };
}
