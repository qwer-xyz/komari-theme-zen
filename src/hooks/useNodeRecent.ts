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

    const fetchRecent = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/recent/${uuid}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RecentApiResponse;
        if (!stopped) {
          setRecords(Array.isArray(json.data) ? json.data : []);
          setError(null);
        }
      } catch (e) {
        if (!stopped) {
          setError(e instanceof Error ? e.message : "Failed to fetch recent");
          setRecords([]);
        }
      } finally {
        if (!stopped) setIsLoading(false);
        if (!stopped) timer = window.setTimeout(fetchRecent, pollMs);
      }
    };

    fetchRecent();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [uuid, enabled, pollMs]);

  return { records, isLoading, error };
}
