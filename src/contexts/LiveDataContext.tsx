import React, { createContext, useContext, useEffect, useState } from "react";
import type { LiveDataResponse } from "../types/LiveData";
import { parseLivePing } from "@/lib/recordTransform";
import { finiteNumber, nonNegativeNumber } from "@/lib/numeric";
import { useRPC2Call } from "./RPC2Context";

export type LiveDataStatus = "loading" | "fresh" | "stale" | "error";
const LIVE_POLL_INTERVAL_MS = 2_000;
const LIVE_FRESHNESS_MS = 8_000;

interface LiveDataContextType {
  live_data: LiveDataResponse | null;
  status: LiveDataStatus;
  error: string | null;
  lastSuccessAt: number | null;
  consecutiveFailures: number;
}

const LiveDataContext = createContext<LiveDataContextType>({
  live_data: null,
  status: "loading",
  error: null,
  lastSuccessAt: null,
  consecutiveFailures: 0,
});

export const LiveDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [live_data, setLiveData] = useState<LiveDataResponse | null>(null);
  const [status, setStatus] = useState<LiveDataStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const { call } = useRPC2Call();

  useEffect(() => {
    let timer: number | undefined;
    let freshnessTimer: number | undefined;
    let stopped = false;
    let running = false;
    let requestController: AbortController | null = null;
    let hasSuccessfulPayload = live_data !== null;
    let lastSuccessfulReceipt = lastSuccessAt ?? 0;
    let failureCount = 0;

    const markStaleIfExpired = () => {
      if (
        !stopped &&
        hasSuccessfulPayload &&
        Date.now() - lastSuccessfulReceipt >= LIVE_FRESHNESS_MS
      ) {
        setStatus((current) => (current === "fresh" ? "stale" : current));
      }
    };

    const scheduleFreshnessDeadline = () => {
      if (freshnessTimer) window.clearTimeout(freshnessTimer);
      const remaining = Math.max(
        0,
        LIVE_FRESHNESS_MS - (Date.now() - lastSuccessfulReceipt),
      );
      freshnessTimer = window.setTimeout(markStaleIfExpired, remaining);
    };

    const scheduleNext = () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) return;
      const retryDelay = failureCount
        ? Math.min(
            30_000,
            LIVE_POLL_INTERVAL_MS * 2 ** Math.min(failureCount - 1, 4),
          )
        : LIVE_POLL_INTERVAL_MS;
      const delay = failureCount
        ? Math.round(retryDelay * (0.85 + Math.random() * 0.3))
        : retryDelay;
      timer = window.setTimeout(fetchLatest, delay);
    };

    const fetchLatest = async () => {
      if (running) return;
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      running = true;
      const controller = new AbortController();
      requestController = controller;
      try {
        const response: unknown = await call(
          "common:getNodesLatestStatus",
          undefined,
          { timeout: 10000, signal: controller.signal },
        );
        if (!response || typeof response !== "object" || Array.isArray(response)) {
          throw new Error("Invalid live status response");
        }
        const entries = Object.entries(response).filter(
          (entry): entry is [string, Record<string, unknown>] =>
            Boolean(entry[1]) &&
            typeof entry[1] === "object" &&
            !Array.isArray(entry[1]),
        );

        const online = entries
          .filter(
            ([, value]) =>
              value.online === true ||
              value.online === 1 ||
              value.online === "true",
          )
          .map(([uuid, value]) => String(value.client ?? uuid))
          .filter(Boolean);

        const dataMap: LiveDataResponse["data"]["data"] = {};
        for (const [uuid, v] of entries) {
          dataMap[uuid] = {
            cpu: { usage: finiteNumber(v.cpu) },
            ram: { used: nonNegativeNumber(v.ram) },
            swap: { used: nonNegativeNumber(v.swap) },
            load: {
              load1: finiteNumber(v.load),
              load5: finiteNumber(v.load5),
              load15: finiteNumber(v.load15),
            },
            disk: { used: nonNegativeNumber(v.disk) },
            network: {
              up: nonNegativeNumber(v.net_out),
              down: nonNegativeNumber(v.net_in),
              totalUp: nonNegativeNumber(v.net_total_out ?? v.net_total_up),
              totalDown: nonNegativeNumber(v.net_total_in ?? v.net_total_down),
            },
            connections: {
              tcp: nonNegativeNumber(v.connections),
              udp: nonNegativeNumber(v.connections_udp),
            },
            gpu:
              v.gpu !== undefined && v.gpu !== null
                ? { count: 0, average_usage: finiteNumber(v.gpu), detailed_info: [] }
                : undefined,
            uptime: nonNegativeNumber(v.uptime),
            process: nonNegativeNumber(v.process),
            message: "",
            updated_at:
              typeof v.time === "string" || typeof v.time === "number"
                ? v.time
                : 0,
            ping: parseLivePing(v.ping),
          };
        }

        const live: LiveDataResponse = {
          data: { online, data: dataMap },
          status: "ok",
        };
        if (!stopped) {
          const receivedAt = Date.now();
          hasSuccessfulPayload = true;
          lastSuccessfulReceipt = receivedAt;
          failureCount = 0;
          setLiveData(live);
          setStatus("fresh");
          setError(null);
          setConsecutiveFailures(0);
          setLastSuccessAt(receivedAt);
          scheduleFreshnessDeadline();
        }
      } catch (e) {
        failureCount += 1;
        if (!stopped) {
          if (freshnessTimer) window.clearTimeout(freshnessTimer);
          setConsecutiveFailures(failureCount);
          setStatus(hasSuccessfulPayload ? "stale" : "error");
          setError(e instanceof Error ? e.message : "Failed to load live data");
        }
        if (!stopped) console.error("RPC2 获取最新状态失败:", e);
      } finally {
        if (requestController === controller) requestController = null;
        running = false;
        scheduleNext();
      }
    };

    const onVisibilityChange = () => {
      if (stopped || document.hidden) return;
      markStaleIfExpired();
      if (timer) window.clearTimeout(timer);
      if (!running) {
        void fetchLatest();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (hasSuccessfulPayload && lastSuccessfulReceipt) {
      scheduleFreshnessDeadline();
    }
    fetchLatest();

    return () => {
      stopped = true;
      requestController?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer) window.clearTimeout(timer);
      if (freshnessTimer) window.clearTimeout(freshnessTimer);
    };
  }, [call]);

  return (
    <LiveDataContext.Provider
      value={{
        live_data,
        status,
        error,
        lastSuccessAt,
        consecutiveFailures,
      }}
    >
      {children}
    </LiveDataContext.Provider>
  );
};

export const useLiveData = () => useContext(LiveDataContext);
