import { useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import type { LoadRecord, LoadRecordsResponse } from "@/types/records";

export function useLoadRecords(uuid: string, hours: number) {
  const { call } = useRPC2Call();
  const { publicInfo } = usePublicInfo();
  const maxHours = publicInfo?.record_preserve_time ?? 0;
  const [records, setRecords] = useState<LoadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicInfo?.record_enabled) {
      setRecords([]);
      return;
    }

    if (!uuid || hours <= 0) {
      setRecords([]);
      return;
    }

    if (maxHours > 0 && hours > maxHours) {
      setRecords([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchRecords = async () => {
      try {
        const result = await call<
          { uuid: string; type: string; hours: number },
          LoadRecordsResponse
        >("common:getRecords", { uuid, type: "load", hours });

        if (cancelled) return;
        const list = result?.records ?? [];
        list.sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        );
        setRecords(list);
      } catch (rpcErr) {
        try {
          const res = await fetch(
            `/api/records/load?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
          );
          if (!res.ok) throw rpcErr;
          const json = await res.json();
          const list = (json.data?.records ?? []) as LoadRecord[];
          list.sort(
            (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
          );
          if (!cancelled) setRecords(list);
        } catch {
          if (!cancelled) {
            setError(
              rpcErr instanceof Error ? rpcErr.message : "Failed to fetch load",
            );
            setRecords([]);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchRecords();

    return () => {
      cancelled = true;
    };
  }, [uuid, hours, maxHours, call, publicInfo?.record_enabled]);

  return { records, isLoading, error, maxHours };
}
