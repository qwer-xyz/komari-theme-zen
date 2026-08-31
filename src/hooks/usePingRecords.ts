import { useEffect, useRef, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import type { PingRecordsResponse } from "@/types/records";
import { queryCommonRecords } from "@/lib/recordQueries";

export function usePingRecords(
  uuid: string,
  hours: number,
  taskIds: number[] = [],
) {
  const { call } = useRPC2Call();
  const { publicInfo } = usePublicInfo();
  const [data, setData] = useState<PingRecordsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef("");

  useEffect(() => {
    if (!publicInfo?.record_enabled) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!uuid || hours <= 0) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const requestKey = `${uuid}:${hours}:${taskIds.join(",")}`;
    if (requestKeyRef.current !== requestKey) {
      requestKeyRef.current = requestKey;
      setData(null);
    }
    setIsLoading(true);
    setError(null);

    queryCommonRecords<PingRecordsResponse>(call, {
      uuid,
      type: "ping",
      hours,
    })
      .then((result) => {
        if (cancelled) return;
        const allowedTasks = new Set(taskIds);
        const tasks = (result?.tasks ?? []).filter(
          (task) => allowedTasks.size === 0 || allowedTasks.has(task.id),
        );
        setData({
          count: result?.count ?? 0,
          records: (result?.records ?? []).filter(
            (record) =>
              allowedTasks.size === 0 || allowedTasks.has(record.task_id),
          ),
          tasks,
        });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uuid, hours, taskIds.join(","), call, publicInfo?.record_enabled]);

  return { data, isLoading, error };
}
