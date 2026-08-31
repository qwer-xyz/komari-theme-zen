import type { useRPC2Call } from "@/contexts/RPC2Context";
import { cachedQuery, queryCacheKey } from "@/lib/queryCache";
import type { LiveRecord } from "@/types/LiveData";

const RECENT_TTL_MS = 8_000;
const RECORDS_TTL_MS = 20_000;

type RpcCall = ReturnType<typeof useRPC2Call>["call"];

type RecentApiResponse = {
  data?: LiveRecord[];
};

export function fetchRecentRecords(uuid: string): Promise<LiveRecord[]> {
  const key = queryCacheKey("http:recent", { uuid });
  return cachedQuery(
    key,
    async () => {
      const response = await fetch(`/api/recent/${encodeURIComponent(uuid)}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as RecentApiResponse;
      return Array.isArray(json.data) ? json.data : [];
    },
    RECENT_TTL_MS,
  );
}

export function queryCommonRecords<T>(
  call: RpcCall,
  params: { uuid: string; type: string; hours: number },
): Promise<T> {
  const key = queryCacheKey("rpc:common:getRecords", params);
  return cachedQuery(
    key,
    () => call<typeof params, T>("common:getRecords", params),
    RECORDS_TTL_MS,
  );
}
