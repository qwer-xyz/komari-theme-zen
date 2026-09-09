import { useCallback, useEffect, useRef, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import type {
  GPUDeviceRecords,
  LoadRecord,
  LoadRecordsResponse,
} from "@/types/records";
import {
  canTryRpcMethod,
  isRpcMethodUnsupported,
  noteRpcMethodFailure,
} from "@/lib/rpcCapability";
import {
  fetchLegacyLoadRecords,
  queryRecords,
  queryCommonRecords,
} from "@/lib/recordQueries";
import { timestampMs } from "@/lib/numeric";

const PUBLIC_RECORDS_METHOD = "public:getRecordsByUUID";

function sortedRecordsByTime<T extends { time: unknown }>(records: T[]): T[] {
  return records
    .map((record) => ({ record, time: timestampMs(record.time) }))
    .filter(
      (entry): entry is { record: T; time: number } => entry.time !== null,
    )
    .sort((a, b) => a.time - b.time)
    .map(({ record }) => record);
}

function normalizeResponse(raw: LoadRecordsResponse | undefined) {
  const records = Array.isArray(raw?.records)
    ? sortedRecordsByTime(raw.records)
    : [];
  const gpuDevices = Object.values(raw?.gpu_devices ?? {})
    .filter((device) => device && typeof device === "object")
    .map((device) => ({
      ...device,
      records: Array.isArray(device.records)
        ? sortedRecordsByTime(device.records)
        : [],
    }))
    .filter((device) => device.records.length > 0)
    .sort((a, b) => a.device_index - b.device_index);
  return { records, gpuDevices };
}

export function useLoadRecords(uuid: string, hours: number) {
  const { call } = useRPC2Call();
  const { publicInfo } = usePublicInfo();
  const maxHours = publicInfo?.record_preserve_time ?? 0;
  const [records, setRecords] = useState<LoadRecord[]>([]);
  const [gpuDevices, setGpuDevices] = useState<GPUDeviceRecords[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef("");
  const [settledKey, setSettledKey] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = useCallback(() => setRetryVersion((v) => v + 1), []);

  useEffect(() => {
    if (!publicInfo?.record_enabled) {
      setRecords([]);
      setGpuDevices([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!uuid || hours <= 0) {
      setRecords([]);
      setGpuDevices([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (maxHours > 0 && hours > maxHours) {
      setRecords([]);
      setGpuDevices([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const requestKey = `${uuid}:${hours}`;
    if (requestKeyRef.current !== requestKey) {
      requestKeyRef.current = requestKey;
      setRecords([]);
      setGpuDevices([]);
    }
    setIsLoading(true);
    setError(null);

    const fetchRecords = async () => {
      try {
        let result: LoadRecordsResponse | undefined;
        if (canTryRpcMethod(PUBLIC_RECORDS_METHOD)) {
          try {
            result = await queryRecords<LoadRecordsResponse>(
              call,
              PUBLIC_RECORDS_METHOD,
              { uuid, load_type: "all", hours: String(hours) },
              controller.signal,
            );
          } catch (error) {
            if (!noteRpcMethodFailure(PUBLIC_RECORDS_METHOD, error)) {
              throw error;
            }
          }
        }
        if (cancelled) return;
        if (!result) {
          result = await queryCommonRecords<LoadRecordsResponse>(
            call,
            {
              uuid,
              type: "load",
              hours,
            },
            controller.signal,
          );
        }

        if (cancelled) return;
        const normalized = normalizeResponse(result);
        setRecords(normalized.records);
        setGpuDevices(normalized.gpuDevices);
      } catch (rpcErr) {
        if (cancelled) return;
        if (!isRpcMethodUnsupported(rpcErr)) {
          if (!cancelled) {
            setError(
              rpcErr instanceof Error ? rpcErr.message : "Failed to fetch load",
            );
          }
          return;
        }
        try {
          const normalized = normalizeResponse(
            await fetchLegacyLoadRecords<LoadRecordsResponse>(
              uuid,
              hours,
              controller.signal,
            ),
          );
          if (!cancelled) {
            setRecords(normalized.records);
            setGpuDevices(normalized.gpuDevices);
          }
        } catch {
          if (!cancelled) {
            setError(
              rpcErr instanceof Error ? rpcErr.message : "Failed to fetch load",
            );
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setSettledKey(requestKey);
        }
      }
    };

    fetchRecords();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [uuid, hours, maxHours, call, publicInfo?.record_enabled, retryVersion]);

  return {
    records,
    gpuDevices,
    isLoading,
    error,
    retry,
    maxHours,
    hasLoaded: settledKey === `${uuid}:${hours}`,
  };
}
