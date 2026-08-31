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
import { finiteNumber, timestampMs } from "@/lib/numeric";
import type { LivePingStat, LiveRecord } from "@/types/LiveData";
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
  const {
    nodeList,
    isLoading: nodesLoading,
    error: nodesError,
    refresh: refreshNodes,
  } = useNodeList();
  const {
    live_data,
    status: liveStatus,
    error: liveError,
    lastSuccessAt,
  } = useLiveData();
  const {
    offlineServerPosition: offlinePosition,
    pingTaskIds,
  } = useThemeSettings();
  const historyRef = useRef<Map<string, NodeHistoryBuffers>>(new Map());
  const historySampleKeyRef = useRef<Map<string, string>>(new Map());
  const mergedLatencyRef = useRef(
    new Map<
      string,
      {
        seed: ReturnType<typeof mergeLatencyHistory>;
        live: ReturnType<typeof mergeLatencyHistory>;
        merged: ReturnType<typeof mergeLatencyHistory>;
      }
    >(),
  );
  const nodeObjectRef = useRef<Map<string, VPSNode>>(new Map());
  const nodesArrayRef = useRef<VPSNode[]>([]);

  const { recordEnabled } = useRecordSettings();

  const onlineUuids = useMemo(() => {
    if (!nodeList || !live_data?.data?.online) return [];
    const set = new Set(live_data.data.online);
    return nodeList.filter((n) => set.has(n.uuid)).map((n) => n.uuid);
  }, [nodeList, live_data]);

  const livePingNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (!live_data?.data?.data) return ids;
    for (const [uuid, record] of Object.entries(
      live_data.data.data as Record<string, LiveRecord>,
    )) {
      if (record.ping !== undefined) ids.add(uuid);
    }
    return ids;
  }, [live_data]);

  const pingFallbackUuids = useMemo(
    () => onlineUuids.filter((uuid) => !livePingNodeIds.has(uuid)),
    [onlineUuids, livePingNodeIds],
  );
  const shouldLoadPingSummary = loadPingSummary || loadLatencyHistory;
  const { summary: pingSummary } = usePingSummary(
    recordEnabled && shouldLoadPingSummary ? pingFallbackUuids : [],
    pingTaskIds,
  );

  const { history: latencySeedHistory } = useLatencyCardHistory(
    recordEnabled && loadLatencyHistory ? onlineUuids : [],
    pingTaskIds,
  );

  useEffect(() => {
    if (!loadLatencyHistory) {
      historyRef.current.clear();
      historySampleKeyRef.current.clear();
      return;
    }
    if (!nodeList || !live_data?.data || liveStatus !== "fresh") return;

    const onlineSet = new Set<string>(live_data.data.online);
    const nodeIds = new Set(nodeList.map((node) => node.uuid));
    for (const uuid of historyRef.current.keys()) {
      if (!nodeIds.has(uuid)) historyRef.current.delete(uuid);
    }
    for (const uuid of historySampleKeyRef.current.keys()) {
      if (!nodeIds.has(uuid)) historySampleKeyRef.current.delete(uuid);
    }

    for (const node of nodeList) {
      const online = onlineSet.has(node.uuid);
      const live = live_data.data.data[node.uuid];
      const latencyMs = online
        ? livePingNodeIds.has(node.uuid)
          ? aggregateLivePing(live?.ping, pingTaskIds)
          : recordEnabled
            ? (pingSummary.get(node.uuid)?.latency ?? 0)
            : 0
        : 0;
      const sourceTime = online ? timestampMs(live?.updated_at) : null;
      if (online && sourceTime === null) continue;
      const sampleKey = online
        ? `${String(live?.updated_at ?? "")}:${latencyMs}`
        : "offline";
      if (historySampleKeyRef.current.get(node.uuid) === sampleKey) continue;
      historySampleKeyRef.current.set(node.uuid, sampleKey);

      const next = pushHistory(
        historyRef.current.get(node.uuid),
        {
          latency: latencyMs,
          latencyAt: sourceTime ?? 0,
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
    livePingNodeIds,
    loadLatencyHistory,
    liveStatus,
  ]);

  const nodes = useMemo((): VPSNode[] => {
    if (!nodeList) return [];

    const onlineSet = new Set<string>(live_data?.data?.online ?? []);
    const sorted = sortNodesByPolicy<NodeBasicInfo>(
      nodeList,
      onlineSet,
      offlinePosition,
    );

    const nextNodes = sorted.map((node) => {
      const online = onlineSet.has(node.uuid);
      const live = live_data?.data?.data[node.uuid];
      const history =
        historyRef.current.get(node.uuid) ?? EMPTY_HISTORY_BUFFERS;
      const latency = livePingNodeIds.has(node.uuid)
        ? aggregateLivePing(live?.ping, pingTaskIds)
        : recordEnabled
          ? (pingSummary.get(node.uuid)?.latency ?? 0)
          : 0;
      const status: VPSNode["status"] =
        liveStatus !== "fresh"
          ? "unknown"
          : online
            ? "online"
            : "offline";
      const vps = mapKomariNodeToVps(
        node,
        live,
        online,
        history,
        latency,
        status,
      );
      const ping = pingSummary.get(node.uuid);
      const allowedLivePingTasks = new Set(pingTaskIds.map(String));
      const livePingEntries = (
        Object.entries(live?.ping ?? {}) as Array<[string, LivePingStat]>
      ).filter(
        ([taskId]) =>
          allowedLivePingTasks.size === 0 ||
          allowedLivePingTasks.has(taskId),
      );
      const liveLoss = livePingEntries.length
        ? livePingEntries.reduce(
            (sum, [, stat]) => sum + Math.max(0, finiteNumber(stat.loss)),
            0,
          ) / livePingEntries.length
        : 0;
      const worstLivePing = [...livePingEntries].sort(
        ([, a], [, b]) =>
          finiteNumber(b.loss) - finiteNumber(a.loss) ||
          finiteNumber(b.latest ?? b.avg) - finiteNumber(a.latest ?? a.avg),
      )[0];
      const withPing = {
        ...vps,
        pingLoss: ping?.loss ?? liveLoss,
        pingVolatility: ping?.volatility ?? 0,
        pingTaskCount: ping?.tasks.length ?? livePingEntries.length,
        pingWorstTask:
          ping?.worstTask?.name ?? worstLivePing?.[1].name ?? worstLivePing?.[0] ?? "",
      };
      let nextNode = withPing;
      if (recordEnabled && online) {
        const seed = latencySeedHistory.get(node.uuid) ?? [];
        const cachedMerge = mergedLatencyRef.current.get(node.uuid);
        const mergedLatency =
          cachedMerge?.seed === seed && cachedMerge.live === history.latencyHistory
            ? cachedMerge.merged
            : mergeLatencyHistory(seed, history.latencyHistory);
        if (cachedMerge?.merged !== mergedLatency) {
          mergedLatencyRef.current.set(node.uuid, {
            seed,
            live: history.latencyHistory,
            merged: mergedLatency,
          });
        }
        nextNode = { ...withPing, latencyHistory: mergedLatency };
      }
      const previous = nodeObjectRef.current.get(node.uuid);
      const reusable =
        previous &&
        (Object.keys(nextNode) as Array<keyof VPSNode>).every(
          (key) => previous[key] === nextNode[key],
        );
      const resolved = reusable ? previous : nextNode;
      nodeObjectRef.current.set(node.uuid, resolved);
      return resolved;
    });

    const activeIds = new Set(nextNodes.map((node) => node.id));
    for (const uuid of nodeObjectRef.current.keys()) {
      if (!activeIds.has(uuid)) nodeObjectRef.current.delete(uuid);
    }
    for (const uuid of mergedLatencyRef.current.keys()) {
      if (!activeIds.has(uuid)) mergedLatencyRef.current.delete(uuid);
    }

    const previousArray = nodesArrayRef.current;
    const reuseArray =
      previousArray.length === nextNodes.length &&
      previousArray.every((node, index) => node === nextNodes[index]);
    nodesArrayRef.current = reuseArray ? previousArray : nextNodes;
    return nodesArrayRef.current;
  }, [
    nodeList,
    live_data,
    offlinePosition,
    pingSummary,
    recordEnabled,
    livePingNodeIds,
    latencySeedHistory,
    pingTaskIds,
    loadLatencyHistory,
    liveStatus,
  ]);

  return {
    nodes,
    isLoading:
      (nodesLoading && !nodeList) ||
      (Boolean(nodeList) && liveStatus === "loading" && !live_data),
    error: nodesError,
    liveStatus,
    liveError,
    lastSuccessAt,
    refreshNodes,
  };
}
