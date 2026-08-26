import { useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import type {
  GPUDeviceRecords,
  LoadRecord,
  LoadRecordsResponse,
} from "@/types/records";
import {
  canTryRpcMethod,
  noteRpcMethodFailure,
} from "@/lib/rpcCapability";

const PUBLIC_RECORDS_METHOD = "public:getRecordsByUUID";

function normalizeResponse(raw: LoadRecordsResponse | undefined) {
  const records = Array.isArray(raw?.records) ? [...raw.records] : [];
  records.sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );
  const gpuDevices = Object.values(raw?.gpu_devices ?? {})
    .map((device) => ({
      ...device,
      records: Array.isArray(device.records)
        ? [...device.records].sort(
            (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
          )
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

  useEffect(() => {
    if (!publicInfo?.record_enabled) {
      setRecords([]);
      setGpuDevices([]);
      return;
    }

    if (!uuid || hours <= 0) {
      setRecords([]);
      setGpuDevices([]);
      return;
    }

    if (maxHours > 0 && hours > maxHours) {
      setRecords([]);
      setGpuDevices([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchRecords = async () => {
      try {
        let result: LoadRecordsResponse | undefined;
        if (canTryRpcMethod(PUBLIC_RECORDS_METHOD)) {
          try {
            result = await call<unknown, LoadRecordsResponse>(
              PUBLIC_RECORDS_METHOD,
              { uuid, load_type: "all", hours: String(hours) },
            );
          } catch (error) {
            noteRpcMethodFailure(PUBLIC_RECORDS_METHOD, error);
          }
        }
        if (!result) {
          result = await call<
            { uuid: string; type: string; hours: number },
            LoadRecordsResponse
          >("common:getRecords", { uuid, type: "load", hours });
        }

        if (cancelled) return;
        const normalized = normalizeResponse(result);
        setRecords(normalized.records);
        setGpuDevices(normalized.gpuDevices);
      } catch (rpcErr) {
        try {
          const res = await fetch(
            `/api/records/load?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
          );
          if (!res.ok) throw rpcErr;
          const json = await res.json();
          const normalized = normalizeResponse(json.data as LoadRecordsResponse);
          if (!cancelled) {
            setRecords(normalized.records);
            setGpuDevices(normalized.gpuDevices);
          }
        } catch {
          if (!cancelled) {
            setError(
              rpcErr instanceof Error ? rpcErr.message : "Failed to fetch load",
            );
            setRecords([]);
            setGpuDevices([]);
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

  return { records, gpuDevices, isLoading, error, maxHours };
}
