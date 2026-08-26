import { useEffect, useMemo, useRef } from "react";
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

const EMPTY_HISTORY_BUFFERS = emptyHistoryBuffers();

type UseKomariNodesOptions = {
  loadPingSummary?: boolean;
  loadLatencyHistory?: boolean;
};

export function useKomariNodes({
  loadPingSummary = true,
  loadLatencyHistory = true,
}: UseKomariNodesOptions = {}) {
  const { nodeList, isLoading: nodesLoading, error: nodesError } = useNodeList();
  const { live_data } = useLiveData();
  const {
    offlineServerPosition: offlinePosition,
    pingTaskIds,
  } = useThemeSettings();
  const historyRef = useRef<Map<string, NodeHistoryBuffers>>(new Map());

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

  const shouldLoadPingSummary =
    loadPingSummary || (loadLatencyHistory && !liveSupportsPing);
  const { summary: pingSummary } = usePingSummary(
    recordEnabled && shouldLoadPingSummary ? onlineUuids : [],
    pingTaskIds,
  );

  const { history: latencySeedHistory } = useLatencyCardHistory(
    recordEnabled && loadLatencyHistory ? onlineUuids : [],
    pingTaskIds,
  );

  useEffect(() => {
    if (!loadLatencyHistory) {
      historyRef.current.clear();
      return;
    }
    if (!nodeList || !live_data?.data) return;

    const onlineSet = new Set<string>(live_data.data.online);

    for (const node of nodeList) {
      const online = onlineSet.has(node.uuid);
      const live = live_data.data.data[node.uuid];
      const latencyMs =
        recordEnabled && online
          ? liveSupportsPing
            ? aggregateLivePing(live?.ping, pingTaskIds)
            : (pingSummary.get(node.uuid)?.latency ?? 0)
          : 0;

      const next = pushHistory(
        historyRef.current.get(node.uuid),
        {
          latency: latencyMs,
          latencyAt: Date.now(),
        },
        online,
      );

      historyRef.current.set(node.uuid, next);
    }
  }, [
    nodeList,
    live_data,
    pingSummary,
    pingTaskIds,
    recordEnabled,
    liveSupportsPing,
    loadLatencyHistory,
  ]);

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
        historyRef.current.get(node.uuid) ?? EMPTY_HISTORY_BUFFERS;
      const latency = recordEnabled
        ? liveSupportsPing
          ? aggregateLivePing(live?.ping, pingTaskIds)
          : (pingSummary.get(node.uuid)?.latency ?? 0)
        : 0;
      const vps = mapKomariNodeToVps(node, live, online, history, latency);
      const ping = pingSummary.get(node.uuid);
      const withPing = {
        ...vps,
        pingLoss: ping?.loss ?? 0,
        pingVolatility: ping?.volatility ?? 0,
        pingTaskCount: ping?.tasks.length ?? 0,
        pingWorstTask: ping?.worstTask?.name ?? "",
      };
      if (!recordEnabled || !online) return withPing;

      const mergedLatency = mergeLatencyHistory(
        latencySeedHistory.get(node.uuid) ?? [],
        history.latencyHistory,
      );
      return { ...withPing, latencyHistory: mergedLatency };
    });
  }, [
    nodeList,
    live_data,
    offlinePosition,
    pingSummary,
    recordEnabled,
    liveSupportsPing,
    latencySeedHistory,
    pingTaskIds,
    loadLatencyHistory,
  ]);

  return {
    nodes,
    isLoading: nodesLoading && !nodeList,
    error: nodesError,
  };
}
