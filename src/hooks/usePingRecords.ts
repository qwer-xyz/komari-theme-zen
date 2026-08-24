import { useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import type { PingRecordsResponse } from "@/types/records";

export function usePingRecords(uuid: string, hours: number) {
  const { call } = useRPC2Call();
  const { publicInfo } = usePublicInfo();
  const [data, setData] = useState<PingRecordsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicInfo?.record_enabled) {
      setData(null);
      return;
    }

    if (!uuid || hours <= 0) {
      setData(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    call<{ uuid: string; type: string; hours: number }, PingRecordsResponse>(
      "common:getRecords",
      { uuid, type: "ping", hours },
    )
      .then((result) => {
        if (cancelled) return;
        setData({
          count: result?.count ?? 0,
          records: result?.records ?? [],
          tasks: result?.tasks ?? [],
        });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uuid, hours, call, publicInfo?.record_enabled]);

  return { data, isLoading, error };
}
