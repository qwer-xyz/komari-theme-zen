import { useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { useRecordSettings } from "@/hooks/useRecordSettings";
import { type LatencySample } from "@/lib/latencyDisplay";
import { pingRecordsToLatencyHistory } from "@/lib/recordTransform";
import type { PingRecordsResponse } from "@/types/records";

const CONCURRENCY = 3;
const POLL_MS = 60_000;
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
): Promise<Map<string, LatencySample[]>> {
  const entries = await mapWithConcurrency<
    string,
    [string, LatencySample[]]
  >(
    nodeUuids,
    CONCURRENCY,
    async (uuid) => {
      try {
        const result = await call<
          { uuid: string; type: string; hours: number },
          PingRecordsResponse
        >("common:getRecords", { uuid, type: "ping", hours: HISTORY_HOURS });
        const samples = pingRecordsToLatencyHistory(
          result?.records ?? [],
          result?.tasks ?? [],
        );
        return [uuid, samples] as [string, LatencySample[]];
      } catch {
        return [uuid, [] as LatencySample[]];
      }
    },
  );

  const map = new Map<string, LatencySample[]>();
  for (const [uuid, samples] of entries) {
    map.set(uuid, samples);
  }
  return map;
}

/** Preload recent ping history for card latency blocks (API seed + live updates). */
export function useLatencyCardHistory(nodeUuids: string[]) {
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
        const map = await fetchLatencyHistories(call, nodeUuids);
        if (cancelled) return;
        setHistory(map);
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
  }, [nodeUuids.join(","), call, recordEnabled]);

  return { history, isLoading };
}
