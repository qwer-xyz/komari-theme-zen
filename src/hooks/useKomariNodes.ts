import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveData } from "@/contexts/LiveDataContext";
import { useNodeList, type NodeBasicInfo } from "@/contexts/NodeListContext";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { useLatencyCardHistory } from "@/hooks/useLatencyCardHistory";
import { usePingSummary } from "@/hooks/usePingSummary";
import { useRecordSettings } from "@/hooks/useRecordSettings";
import {
  mapKomariNodeToVps,
  pushHistory,
  sortNodesByPolicy,
  type NodeHistoryBuffers,
} from "@/lib/komariMapper";
import { mergeLatencyHistory, LATENCY_HISTORY_LEN } from "@/lib/latencyDisplay";
import { aggregateLivePing } from "@/lib/recordTransform";
import type { LiveRecord } from "@/types/LiveData";
import type { VPSNode } from "@/types";

function emptyHistoryBuffers(): NodeHistoryBuffers {
  return {
    cpuHistory: Array(20).fill(0),
    memHistory: Array(20).fill(0),
    netInHistory: Array(20).fill(0),
    netOutHistory: Array(20).fill(0),
    swapHistory: Array(20).fill(0),
    diskHistory: Array(20).fill(0),
    tcpHistory: Array(20).fill(0),
    udpHistory: Array(20).fill(0),
    processesHistory: Array(20).fill(0),
    latencyHistory: Array.from({ length: LATENCY_HISTORY_LEN }, () => ({
      ms: 0,
      t: 0,
    })),
  };
}

export function useKomariNodes() {
  const { nodeList, isLoading: nodesLoading, error: nodesError } = useNodeList();
  const { live_data } = useLiveData();
  const { offlineServerPosition: offlinePosition } = useThemeSettings();
  const historyRef = useRef<Map<string, NodeHistoryBuffers>>(new Map());
  const [historyTick, setHistoryTick] = useState(0);

  const { recordEnabled } = useRecordSettings();

  const onlineUuids = useMemo(() => {
    if (!nodeList || !live_data?.data?.online) return [];
    const set = new Set(live_data.data.online);
    return nodeList.filter((n) => set.has(n.uuid)).map((n) => n.uuid);
  }, [nodeList, live_data]);

  const liveSupportsPing = useMemo(() => {
    if (!live_data?.data?.data) return false;
    return Object.values(live_data.data.data as Record<string, LiveRecord>).some(
      (r) => r.ping !== undefined,
    );
  }, [live_data]);

  const { summary: pingSummary } = usePingSummary(
    recordEnabled && !liveSupportsPing ? onlineUuids : [],
  );

  const { history: latencySeedHistory } = useLatencyCardHistory(
    recordEnabled ? onlineUuids : [],
  );

  useEffect(() => {
    if (!nodeList || !live_data?.data) return;

    const onlineSet = new Set<string>(live_data.data.online);
    let changed = false;

    for (const node of nodeList) {
      const online = onlineSet.has(node.uuid);
      const live = live_data.data.data[node.uuid];
      const memoryTotalGb = node.mem_total / 1024 ** 3;
      const diskTotalGb = node.disk_total / 1024 ** 3;
      const swapTotalGb = node.swap_total / 1024 ** 3;
      const memoryUsedGb = online ? (live?.ram.used ?? 0) / 1024 ** 3 : 0;
      const memPercent =
        memoryTotalGb > 0 ? (memoryUsedGb / memoryTotalGb) * 100 : 0;

      let swapPercent = 0;
      if (online && swapTotalGb > 0 && live?.swap.used) {
        const swapUsed =
          live.swap.used <= 100 && swapTotalGb > 0
            ? (live.swap.used / 100) * swapTotalGb
            : live.swap.used / 1024 ** 3;
        swapPercent = (swapUsed / swapTotalGb) * 100;
      }

      let diskPercent = 0;
      if (online && diskTotalGb > 0 && live?.disk.used) {
        const diskUsed =
          live.disk.used <= 100
            ? (live.disk.used / 100) * diskTotalGb
            : live.disk.used / 1024 ** 3;
        diskPercent = (diskUsed / diskTotalGb) * 100;
      }

      const latencyMs =
        recordEnabled && online
          ? liveSupportsPing
            ? aggregateLivePing(live?.ping)
            : (pingSummary.get(node.uuid)?.latency ?? 0)
          : 0;

      const next = pushHistory(
        historyRef.current.get(node.uuid),
        {
          cpu: online ? (live?.cpu.usage ?? 0) : 0,
          memPercent,
          netIn: online ? (live?.network.down ?? 0) / 1024 : 0,
          netOut: online ? (live?.network.up ?? 0) / 1024 : 0,
          swapPercent,
          diskPercent,
          tcp: online ? (live?.connections.tcp ?? 0) : 0,
          udp: online ? (live?.connections.udp ?? 0) : 0,
          processes: online ? (live?.process ?? 0) : 0,
          latency: latencyMs,
          latencyAt: Date.now(),
        },
        online,
      );

      historyRef.current.set(node.uuid, next);
      changed = true;
    }

    if (changed) {
      setHistoryTick((n) => n + 1);
    }
  }, [nodeList, live_data, pingSummary, recordEnabled, liveSupportsPing]);

  const nodes = useMemo((): VPSNode[] => {
    if (!nodeList) return [];

    const onlineSet = new Set<string>(live_data?.data?.online ?? []);
    const sorted = sortNodesByPolicy<NodeBasicInfo>(
      nodeList,
      onlineSet,
      offlinePosition,
    );

    return sorted.map((node) => {
      const online = onlineSet.has(node.uuid);
      const live = live_data?.data?.data[node.uuid];
      const history =
        historyRef.current.get(node.uuid) ?? emptyHistoryBuffers();
      const latency = recordEnabled
        ? liveSupportsPing
          ? aggregateLivePing(live?.ping)
          : (pingSummary.get(node.uuid)?.latency ?? 0)
        : 0;
      const vps = mapKomariNodeToVps(node, live, online, history, latency);
      if (!recordEnabled || !online) return vps;

      const mergedLatency = mergeLatencyHistory(
        latencySeedHistory.get(node.uuid) ?? [],
        history.latencyHistory,
      );
      return { ...vps, latencyHistory: mergedLatency };
    });
  }, [
    nodeList,
    live_data,
    historyTick,
    offlinePosition,
    pingSummary,
    recordEnabled,
    liveSupportsPing,
    latencySeedHistory,
  ]);

  return {
    nodes,
    isLoading: nodesLoading && !nodeList,
    error: nodesError,
  };
}
