import React, { createContext, useContext, useEffect, useState } from "react";
import type { LiveDataResponse } from "../types/LiveData";
import { parseLivePing } from "@/lib/recordTransform";
import { useRPC2Call } from "./RPC2Context";

interface LiveDataContextType {
  live_data: LiveDataResponse | null;
}

const LiveDataContext = createContext<LiveDataContextType>({
  live_data: null,
});

export const LiveDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [live_data, setLiveData] = useState<LiveDataResponse | null>(null);
  const { call } = useRPC2Call();

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    let running = false;
    const intervalMs = 2000;

    const scheduleNext = () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) return;
      timer = window.setTimeout(fetchLatest, intervalMs);
    };

    const fetchLatest = async () => {
      if (running) return;
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      running = true;
      try {
        const result: Record<string, Record<string, unknown>> = await call(
          "common:getNodesLatestStatus",
          undefined,
          { timeout: 10000 },
        );

        const online = Object.values(result)
          .filter((v) => v?.online)
          .map((v) => String(v.client));

        const dataMap: LiveDataResponse["data"]["data"] = {};
        for (const [uuid, v] of Object.entries(result)) {
          dataMap[uuid] = {
            cpu: { usage: typeof v.cpu === "number" ? v.cpu : 0 },
            ram: { used: Number(v.ram ?? 0) },
            swap: { used: Number(v.swap ?? 0) },
            load: {
              load1: Number(v.load ?? 0),
              load5: Number(v.load5 ?? 0),
              load15: Number(v.load15 ?? 0),
            },
            disk: { used: Number(v.disk ?? 0) },
            network: {
              up: Number(v.net_out ?? 0),
              down: Number(v.net_in ?? 0),
              totalUp: Number(v.net_total_out ?? v.net_total_up ?? 0),
              totalDown: Number(v.net_total_in ?? v.net_total_down ?? 0),
            },
            connections: {
              tcp: Number(v.connections ?? 0),
              udp: Number(v.connections_udp ?? 0),
            },
            gpu:
              v.gpu !== undefined
                ? { count: 0, average_usage: Number(v.gpu), detailed_info: [] }
                : undefined,
            uptime: Number(v.uptime ?? 0),
            process: Number(v.process ?? 0),
            message: "",
            updated_at: (v.time as string | number) ?? 0,
            ping: parseLivePing(v.ping),
          };
        }

        const live: LiveDataResponse = {
          data: { online, data: dataMap },
          status: "ok",
        };
        setLiveData(live);
      } catch (e) {
        console.error("RPC2 获取最新状态失败:", e);
      } finally {
        running = false;
        scheduleNext();
      }
    };

    const onVisibilityChange = () => {
      if (stopped || document.hidden) return;
      if (timer) window.clearTimeout(timer);
      if (!running) {
        void fetchLatest();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    fetchLatest();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer) window.clearTimeout(timer);
    };
  }, [call]);

  return (
    <LiveDataContext.Provider value={{ live_data }}>
      {children}
    </LiveDataContext.Provider>
  );
};

export const useLiveData = () => useContext(LiveDataContext);
