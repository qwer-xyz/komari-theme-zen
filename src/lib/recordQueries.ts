import type { useRPC2Call } from "@/contexts/RPC2Context";
import { cachedQuery, queryCacheKey } from "@/lib/queryCache";
import { scheduleHistory } from "@/lib/requestQueue";
import type { LiveRecord } from "@/types/LiveData";

const RECENT_TTL_MS = 8_000;
const RECORDS_TTL_MS = 20_000;

export function fetchLegacyLoadRecords<T>(
  uuid: string,
  hours: number,
  signal?: AbortSignal,
): Promise<T> {
  return cachedQuery(
    queryCacheKey("http:load", { uuid, hours }),
    (sharedSignal) =>
      scheduleHistory(async () => {
        const response = await fetch(
          `/api/records/load?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
          {
            signal: AbortSignal.any([
              sharedSignal,
              AbortSignal.timeout(15_000),
            ]),
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        return json.data as T;
      }, sharedSignal),
    RECORDS_TTL_MS,
    signal,
  );
}

type RpcCall = ReturnType<typeof useRPC2Call>["call"];

type RecentApiResponse = {
  data?: LiveRecord[];
};

export function fetchRecentRecords(
  uuid: string,
  signal?: AbortSignal,
): Promise<LiveRecord[]> {
  const key = queryCacheKey("http:recent", { uuid });
  return cachedQuery(
    key,
    (sharedSignal) =>
      scheduleHistory(async () => {
        const response = await fetch(
          `/api/recent/${encodeURIComponent(uuid)}`,
          {
            signal: AbortSignal.any([
              sharedSignal,
              AbortSignal.timeout(10_000),
            ]),
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as RecentApiResponse;
        return Array.isArray(json.data) ? json.data : [];
      }, sharedSignal),
    RECENT_TTL_MS,
    signal,
  );
}

export function queryCommonRecords<T>(
  call: RpcCall,
  params: { uuid: string; type: string; hours: number },
  signal?: AbortSignal,
): Promise<T> {
  return queryRecords<T>(call, "common:getRecords", params, signal);
}
export function queryRecords<T>(
  call: RpcCall,
  method: string,
  params: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return cachedQuery(
    queryCacheKey("rpc:" + method, params),
    (sharedSignal) =>
      scheduleHistory(
        () => call<unknown, T>(method, params, { signal: sharedSignal }),
        sharedSignal,
      ),
    RECORDS_TTL_MS,
    signal,
  );
}
