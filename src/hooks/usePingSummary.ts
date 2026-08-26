import { useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { aggregateLatency } from "@/lib/recordTransform";
import type { PingRecordsResponse, PingTaskInfo } from "@/types/records";
import type {
  PingMetricStat,
  PingMetricStatsResponse,
} from "@/types/metrics";
import {
  canTryRpcMethod,
  noteRpcMethodFailure,
} from "@/lib/rpcCapability";

export type PingSummaryEntry = {
  latency: number;
  tasks: PingTaskInfo[];
  loss: number;
  volatility: number;
  worstTask?: PingTaskInfo;
};

/** Card latency: short window + periodic refresh (not full 1h history). */
const CONCURRENCY = 3;
const POLL_MS = 45_000;
const WINDOW_MS = 5 * 60 * 1000;
/** Trim unused `records` payload; card only reads `tasks`. */
const MAX_COUNT = 1;
const METRIC_METHOD = "public:getPingMetricStats";

type PingSummaryParams = {
  uuid: string;
  type: "ping";
  start: string;
  end: string;
  maxCount: number;
};

function buildPingSummaryParams(uuid: string): PingSummaryParams {
  const end = new Date();
  const start = new Date(end.getTime() - WINDOW_MS);
  return {
    uuid,
    type: "ping",
    start: start.toISOString(),
    end: end.toISOString(),
    maxCount: MAX_COUNT,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

async function fetchPingSummaries(
  call: ReturnType<typeof useRPC2Call>["call"],
  nodeUuids: string[],
  taskIds: number[],
): Promise<Map<string, PingSummaryEntry>> {
  if (canTryRpcMethod(METRIC_METHOD)) {
    try {
      const response = await call<unknown, PingMetricStatsResponse>(
        METRIC_METHOD,
        {
          entity_ids: nodeUuids,
          task_ids: taskIds,
          hours: 1,
          max_points: 120,
        },
      );
      if (Array.isArray(response?.stats)) {
        return buildMetricSummaryMap(nodeUuids, response.stats);
      }
    } catch (error) {
      noteRpcMethodFailure(METRIC_METHOD, error);
    }
  }

  const allowedTasks = new Set(taskIds);
  const entries = await mapWithConcurrency(
    nodeUuids,
    CONCURRENCY,
    async (uuid) => {
      try {
        const result = await call<PingSummaryParams, PingRecordsResponse>(
          "common:getRecords",
          buildPingSummaryParams(uuid),
        );
        const tasks = (result?.tasks ?? []).filter(
          (task) => allowedTasks.size === 0 || allowedTasks.has(task.id),
        );
        return [uuid, buildSummaryEntry(tasks)] as const;
      } catch {
        return [uuid, buildSummaryEntry([])] as const;
      }
    },
  );

  const map = new Map<string, PingSummaryEntry>();
  for (const [uuid, entry] of entries) {
    map.set(uuid, entry);
  }
  return map;
}

function buildSummaryEntry(tasks: PingTaskInfo[]): PingSummaryEntry {
  const totalSamples = tasks.reduce((sum, task) => sum + (task.total ?? 0), 0);
  const loss = totalSamples
    ? tasks.reduce(
        (sum, task) => sum + (task.loss ?? 0) * (task.total ?? 0),
        0,
      ) / totalSamples
    : tasks.length
      ? tasks.reduce((sum, task) => sum + (task.loss ?? 0), 0) / tasks.length
      : 0;
  const volatility = tasks.reduce(
    (max, task) => Math.max(max, task.p99_p50_ratio ?? 0),
    0,
  );
  const worstTask = [...tasks].sort(
    (a, b) =>
      (b.loss ?? 0) - (a.loss ?? 0) ||
      (b.latest ?? b.avg ?? 0) - (a.latest ?? a.avg ?? 0),
  )[0];
  return { latency: aggregateLatency(tasks), tasks, loss, volatility, worstTask };
}

function statToTask(stat: PingMetricStat): PingTaskInfo {
  return {
    id: Number(stat.task_id),
    name: stat.name || `Ping ${stat.task_id}`,
    interval: stat.interval ?? 0,
    type: stat.type,
    loss: stat.loss ?? 0,
    total: stat.total,
    valid: stat.valid,
    loss_approximate: stat.loss_approximate,
    latest: stat.latest,
    avg: stat.avg,
    min: stat.min,
    max: stat.max,
    p50: stat.p50,
    p99: stat.p99,
    stddev: stat.stddev,
    p99_p50_ratio: stat.p99_p50_ratio,
  };
}

function buildMetricSummaryMap(
  nodeUuids: string[],
  stats: PingMetricStat[],
): Map<string, PingSummaryEntry> {
  const tasksByNode = new Map<string, PingTaskInfo[]>();
  for (const stat of stats) {
    const tasks = tasksByNode.get(stat.entity_id) ?? [];
    tasks.push(statToTask(stat));
    tasksByNode.set(stat.entity_id, tasks);
  }
  return new Map(
    nodeUuids.map((uuid) => [
      uuid,
      buildSummaryEntry(tasksByNode.get(uuid) ?? []),
    ]),
  );
}

export function usePingSummary(nodeUuids: string[], taskIds: number[] = []) {
  const { call } = useRPC2Call();
  const [summary, setSummary] = useState<Map<string, PingSummaryEntry>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (nodeUuids.length === 0) {
      setSummary(new Map());
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let running = false;

    const scheduleNext = () => {
      if (cancelled || document.hidden) return;
      timer = window.setTimeout(() => {
        void refresh(false);
      }, POLL_MS);
    };

    const refresh = async (initial: boolean) => {
      if (cancelled || running || document.hidden) return;
      running = true;
      if (initial) setIsLoading(true);

      try {
        const map = await fetchPingSummaries(call, nodeUuids, taskIds);
        if (cancelled) return;
        setSummary(map);
      } finally {
        running = false;
        if (!cancelled && initial) setIsLoading(false);
        if (!cancelled) scheduleNext();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden || cancelled || running) return;
      if (timer) window.clearTimeout(timer);
      void refresh(false);
    };

    void refresh(true);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [nodeUuids.join(","), taskIds.join(","), call]);

  return { summary, isLoading };
}
