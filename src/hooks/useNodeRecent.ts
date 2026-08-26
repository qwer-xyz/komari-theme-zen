import { useEffect, useState } from "react";
import type { LiveRecord } from "@/types/LiveData";

type RecentApiResponse = {
  data?: LiveRecord[];
  status?: string;
};

export function useNodeRecent(
  uuid: string | null,
  enabled: boolean,
  pollMs = 10000,
) {
  const [records, setRecords] = useState<LiveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid || !enabled) {
      setRecords([]);
      return;
    }

    let stopped = false;
    let timer: number | undefined;
    let running = false;
    let controller: AbortController | null = null;

    const scheduleNext = () => {
      if (stopped || document.hidden) return;
      timer = window.setTimeout(() => void fetchRecent(false), pollMs);
    };

    const fetchRecent = async (initial: boolean) => {
      if (stopped || running || document.hidden) return;
      running = true;
      if (initial) setIsLoading(true);
      controller = new AbortController();
      try {
        const res = await fetch(`/api/recent/${encodeURIComponent(uuid)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RecentApiResponse;
        if (!stopped) {
          setRecords(Array.isArray(json.data) ? json.data : []);
          setError(null);
        }
      } catch (e) {
        if (!stopped && !(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Failed to fetch recent");
          setRecords([]);
        }
      } finally {
        running = false;
        controller = null;
        if (!stopped && initial) setIsLoading(false);
        scheduleNext();
      }
    };

    const onVisibilityChange = () => {
      if (stopped || document.hidden || running) return;
      if (timer) window.clearTimeout(timer);
      void fetchRecent(false);
    };

    void fetchRecent(true);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      controller?.abort();
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [uuid, enabled, pollMs]);

  return { records, isLoading, error };
}
