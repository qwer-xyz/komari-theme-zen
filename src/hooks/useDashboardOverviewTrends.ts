/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { useEffect, useMemo, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { useRecordSettings } from "@/hooks/useRecordSettings";
import {
  aggregateDashboardTrends,
  loadRecordsToDashboardTrend,
  recentRecordsToDashboardTrend,
  type DashboardTrendSample,
} from "@/lib/dashboardTrend";
import type {
  DashboardBandwidthMetric,
  DashboardCpuMetric,
} from "@/hooks/useThemeSettings";
import type { LiveRecord } from "@/types/LiveData";
import type { LoadRecord } from "@/types/records";
import type { QueryMetricsResponse } from "@/types/metrics";
import type { VPSNode } from "@/types";
import {
  canTryRpcMethod,
  noteRpcMethodFailure,
} from "@/lib/rpcCapability";

const HISTORY_HOURS = 1;
const POLL_MS = 60_000;
const CONCURRENCY = 3;
const METRIC_METHOD = "public:queryMetrics";

type RecentApiResponse = {
  data?: LiveRecord[];
};

function extractLoadRecords(raw: unknown): LoadRecord[] {
  if (!raw || typeof raw !== "object") return [];
  const records = (raw as { records?: unknown }).records;
  if (Array.isArray(records)) return records as LoadRecord[];
  if (!records || typeof records !== "object") return [];

  return Object.values(records).flatMap((value) =>
    Array.isArray(value) ? (value as LoadRecord[]) : [],
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

async function fetchRecent(uuid: string): Promise<DashboardTrendSample[]> {
  try {
    const response = await fetch(`/api/recent/${encodeURIComponent(uuid)}`);
    if (!response.ok) return [];
    const json = (await response.json()) as RecentApiResponse;
    return recentRecordsToDashboardTrend(
      Array.isArray(json.data) ? json.data : [],
    );
  } catch {
    return [];
  }
}

async function fetchLoadRecords(
  call: ReturnType<typeof useRPC2Call>["call"],
  uuid: string,
): Promise<LoadRecord[]> {
  try {
    const result = await call<
      { uuid: string; type: "load"; hours: number },
      unknown
    >("common:getRecords", { uuid, type: "load", hours: HISTORY_HOURS });
    return extractLoadRecords(result);
  } catch (rpcError) {
    try {
      const response = await fetch(
        `/api/records/load?uuid=${encodeURIComponent(uuid)}&hours=${HISTORY_HOURS}`,
      );
      if (!response.ok) throw rpcError;
      const json = (await response.json()) as { data?: unknown };
      return extractLoadRecords(json.data);
    } catch {
      return [];
    }
  }
}

async function fetchNodeTrend(
  call: ReturnType<typeof useRPC2Call>["call"],
  uuid: string,
  recordEnabled: boolean,
): Promise<[string, DashboardTrendSample[]]> {
  if (recordEnabled) {
    const loadRecords = await fetchLoadRecords(call, uuid);
    const samples = loadRecordsToDashboardTrend(loadRecords);
    if (samples.length) return [uuid, samples];
  }
  return [uuid, await fetchRecent(uuid)];
}

async function fetchMetricTrends(
  call: ReturnType<typeof useRPC2Call>["call"],
  entityIds: string[],
): Promise<Map<string, DashboardTrendSample[]> | null> {
  if (!canTryRpcMethod(METRIC_METHOD)) return null;

  try {
    const entityIdSet = new Set(entityIds);
    const response = await call<unknown, QueryMetricsResponse>(METRIC_METHOD, {
      metric_keys: ["cpu.usage", "net.in.rate", "net.out.rate"],
      entity_ids: entityIds,
      hours: HISTORY_HOURS,
      aggregation: "avg",
      fill_empty: true,
      max_points: 36,
    });
    if (!Array.isArray(response?.series)) return null;

    const buckets = new Map<
      string,
      Map<number, { cpu?: number | null; netIn?: number | null; netOut?: number | null }>
    >();
    for (const series of response.series) {
      if (!entityIdSet.has(series.entity_id)) continue;
      const entity = buckets.get(series.entity_id) ?? new Map();
      for (const point of series.points ?? []) {
        const timestamp = new Date(point.time).getTime();
        if (!Number.isFinite(timestamp)) continue;
        const bucket = entity.get(timestamp) ?? {};
        if (series.metric_key === "cpu.usage") bucket.cpu = point.value;
        if (series.metric_key === "net.in.rate") bucket.netIn = point.value;
        if (series.metric_key === "net.out.rate") bucket.netOut = point.value;
        entity.set(timestamp, bucket);
      }
      buckets.set(series.entity_id, entity);
    }

    const histories = new Map<string, DashboardTrendSample[]>();
    for (const entityId of entityIds) {
      const entity = buckets.get(entityId);
      const samples = entity
        ? [...entity.entries()]
            .sort(([a], [b]) => a - b)
            .map(([t, values]) => ({
              t,
              cpu:
                values.cpu != null && Number.isFinite(values.cpu)
                  ? Math.max(0, values.cpu)
                  : null,
              bandwidth:
                values.netIn != null || values.netOut != null
                  ? Math.max(0, values.netIn ?? 0) +
                    Math.max(0, values.netOut ?? 0)
                  : null,
            }))
        : [];
      histories.set(entityId, samples);
    }
    return histories;
  } catch (error) {
    noteRpcMethodFailure(METRIC_METHOD, error);
    return null;
  }
}

export function useDashboardOverviewTrends(
  nodes: VPSNode[],
  enabled: boolean,
  cpuMetric: DashboardCpuMetric,
  bandwidthMetric: DashboardBandwidthMetric,
) {
  const { call } = useRPC2Call();
  const { recordEnabled } = useRecordSettings();
  const onlineNodeIds = nodes
    .filter((node) => node.online)
    .map((node) => node.id);
  const nodeKey = onlineNodeIds.join(",");
  const [histories, setHistories] = useState<
    Map<string, DashboardTrendSample[]>
  >(new Map());

  useEffect(() => {
    if (!enabled || onlineNodeIds.length === 0) {
      setHistories(new Map());
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let running = false;

    const scheduleNext = () => {
      if (cancelled) return;
      timer = window.setTimeout(() => void refresh(), POLL_MS);
    };

    const refresh = async () => {
      if (cancelled || running || document.hidden) return;
      running = true;
      try {
        const metricHistories = recordEnabled
          ? await fetchMetricTrends(call, onlineNodeIds)
          : null;
        if (metricHistories) {
          if (!cancelled) setHistories(metricHistories);
        } else {
          const entries = await mapWithConcurrency(
            onlineNodeIds,
            CONCURRENCY,
            (uuid) => fetchNodeTrend(call, uuid, recordEnabled),
          );
          if (!cancelled) setHistories(new Map(entries));
        }
      } finally {
        running = false;
        scheduleNext();
      }
    };

    const onVisibilityChange = () => {
      if (cancelled || document.hidden || running) return;
      if (timer) window.clearTimeout(timer);
      void refresh();
    };

    void refresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, nodeKey, recordEnabled, call]);

  return useMemo(() => {
    if (!enabled) return { cpu: [], bandwidth: [] };
    const now = Date.now();
    const current = new Map<string, DashboardTrendSample>();
    for (const node of nodes) {
      if (!node.online) continue;
      current.set(node.id, {
        t: now,
        cpu: Number.isFinite(node.cpuUsage) ? Math.max(0, node.cpuUsage) : null,
        bandwidth:
          Number.isFinite(node.netSpeedIn) && Number.isFinite(node.netSpeedOut)
            ? Math.max(0, node.netSpeedIn + node.netSpeedOut) * 1024
            : null,
      });
    }
    return aggregateDashboardTrends(histories, current, {
      cpuMetric,
      bandwidthMetric,
      endMs: now,
    });
  }, [enabled, histories, nodes, cpuMetric, bandwidthMetric]);
}
