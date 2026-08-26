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
import type { VPSNode } from "@/types";

const HISTORY_HOURS = 1;
const POLL_MS = 60_000;
const CONCURRENCY = 3;

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
        const entries = await mapWithConcurrency(
          onlineNodeIds,
          CONCURRENCY,
          (uuid) => fetchNodeTrend(call, uuid, recordEnabled),
        );
        if (!cancelled) setHistories(new Map(entries));
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
