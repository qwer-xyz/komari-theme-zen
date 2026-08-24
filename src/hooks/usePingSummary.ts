import { useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { aggregateLatency } from "@/lib/recordTransform";
import type { PingRecordsResponse, PingTaskInfo } from "@/types/records";

export type PingSummaryEntry = {
  latency: number;
  tasks: PingTaskInfo[];
};

/** Card latency: short window + periodic refresh (not full 1h history). */
const CONCURRENCY = 3;
const POLL_MS = 45_000;
const WINDOW_MS = 5 * 60 * 1000;
/** Trim unused `records` payload; card only reads `tasks`. */
const MAX_COUNT = 1;

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
): Promise<Map<string, PingSummaryEntry>> {
  const entries = await mapWithConcurrency(
    nodeUuids,
    CONCURRENCY,
    async (uuid) => {
      try {
        const result = await call<PingSummaryParams, PingRecordsResponse>(
          "common:getRecords",
          buildPingSummaryParams(uuid),
        );
        const tasks = result?.tasks ?? [];
        return [uuid, { latency: aggregateLatency(tasks), tasks }] as const;
      } catch {
        return [uuid, { latency: 0, tasks: [] }] as const;
      }
    },
  );

  const map = new Map<string, PingSummaryEntry>();
  for (const [uuid, entry] of entries) {
    map.set(uuid, entry);
  }
  return map;
}

export function usePingSummary(nodeUuids: string[]) {
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

    const scheduleNext = () => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void refresh(false);
      }, POLL_MS);
    };

    const refresh = async (initial: boolean) => {
      if (cancelled) return;
      if (initial) setIsLoading(true);

      try {
        const map = await fetchPingSummaries(call, nodeUuids);
        if (cancelled) return;
        setSummary(map);
      } finally {
        if (!cancelled && initial) setIsLoading(false);
        if (!cancelled) scheduleNext();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden || cancelled) return;
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
  }, [nodeUuids.join(","), call]);

  return { summary, isLoading };
}
