import { useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { useRecordSettings } from "@/hooks/useRecordSettings";
import { type LatencySample } from "@/lib/latencyDisplay";
import { pingRecordsToLatencyHistory } from "@/lib/recordTransform";
import type { PingRecordsResponse } from "@/types/records";
import { queryCommonRecords } from "@/lib/recordQueries";

const CONCURRENCY = 3;
const POLL_MS = 5 * 60_000;
/** Enough window for card latency blocks at typical ping intervals (30–60s). */
const HISTORY_HOURS = 1;

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

async function fetchLatencyHistories(
  call: ReturnType<typeof useRPC2Call>["call"],
  nodeUuids: string[],
  taskIds: number[],
): Promise<Map<string, LatencySample[]>> {
  const allowedTasks = new Set(taskIds);
  const entries = await mapWithConcurrency<
    string,
    [string, LatencySample[]] | null
  >(
    nodeUuids,
    CONCURRENCY,
    async (uuid) => {
      try {
        const result = await queryCommonRecords<PingRecordsResponse>(call, {
          uuid,
          type: "ping",
          hours: HISTORY_HOURS,
        });
        const tasks = (result?.tasks ?? []).filter(
          (task) => allowedTasks.size === 0 || allowedTasks.has(task.id),
        );
        const records = (result?.records ?? []).filter(
          (record) =>
            allowedTasks.size === 0 || allowedTasks.has(record.task_id),
        );
        const samples = pingRecordsToLatencyHistory(
          records,
          tasks,
        );
        return [uuid, samples] as [string, LatencySample[]];
      } catch {
        return null;
      }
    },
  );

  const map = new Map<string, LatencySample[]>();
  for (const entry of entries) {
    if (!entry) continue;
    const [uuid, samples] = entry;
    map.set(uuid, samples);
  }
  return map;
}

/** Preload recent ping history for card latency blocks (API seed + live updates). */
export function useLatencyCardHistory(
  nodeUuids: string[],
  taskIds: number[] = [],
) {
  const { call } = useRPC2Call();
  const { recordEnabled } = useRecordSettings();
  const [history, setHistory] = useState<Map<string, LatencySample[]>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!recordEnabled || nodeUuids.length === 0) {
      setHistory(new Map());
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
        const map = await fetchLatencyHistories(call, nodeUuids, taskIds);
        if (cancelled) return;
        setHistory((previous) => {
          const next = new Map<string, LatencySample[]>();
          for (const uuid of nodeUuids) {
            if (map.has(uuid)) next.set(uuid, map.get(uuid) ?? []);
            else if (previous.has(uuid)) {
              next.set(uuid, previous.get(uuid) ?? []);
            }
          }
          return next;
        });
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
  }, [nodeUuids.join(","), taskIds.join(","), call, recordEnabled]);

  return { history, isLoading };
}
