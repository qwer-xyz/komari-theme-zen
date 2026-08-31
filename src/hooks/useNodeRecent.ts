import { useEffect, useState } from "react";
import type { LiveRecord } from "@/types/LiveData";
import { fetchRecentRecords } from "@/lib/recordQueries";

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
      setIsLoading(false);
      setError(null);
      return;
    }

    let stopped = false;
    let timer: number | undefined;
    let running = false;
    setRecords([]);

    const scheduleNext = () => {
      if (stopped || document.hidden) return;
      timer = window.setTimeout(() => void fetchRecent(false), pollMs);
    };

    const fetchRecent = async (initial: boolean) => {
      if (stopped || running || document.hidden) return;
      running = true;
      if (initial) setIsLoading(true);
      try {
        const nextRecords = await fetchRecentRecords(uuid);
        if (!stopped) {
          setRecords(nextRecords);
          setError(null);
        }
      } catch (e) {
        if (!stopped) {
          setError(e instanceof Error ? e.message : "Failed to fetch recent");
        }
      } finally {
        running = false;
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
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [uuid, enabled, pollMs]);

  return { records, isLoading, error };
}
