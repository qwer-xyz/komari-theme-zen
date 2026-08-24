import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveRecord } from "@/types/LiveData";
import type { VPSNode } from "@/types";
import type { LatencySample } from "@/lib/latencyDisplay";
import { LATENCY_HISTORY_LEN } from "@/lib/latencyDisplay";
import {
  formatLoadAverage,
  resolveDiskUsedGb,
  resolveSwapUsedGb,
  resolveTrafficLimitGb,
} from "@/lib/recordTransform";

const GB = 1024 ** 3;
export const HISTORY_LEN = 20;

export type NodeHistoryBuffers = {
  cpuHistory: number[];
  memHistory: number[];
  netInHistory: number[];
  netOutHistory: number[];
  swapHistory: number[];
  diskHistory: number[];
  tcpHistory: number[];
  udpHistory: number[];
  processesHistory: number[];
  latencyHistory: LatencySample[];
};

export function bytesToGb(bytes: number): number {
  if (!bytes || bytes <= 0) return 0;
  return bytes / GB;
}

export function bytesPerSecToKbps(bytesPerSec: number): number {
  return bytesPerSec / 1024;
}

function emptyHistory(): NodeHistoryBuffers {
  return {
    cpuHistory: Array(HISTORY_LEN).fill(0),
    memHistory: Array(HISTORY_LEN).fill(0),
    netInHistory: Array(HISTORY_LEN).fill(0),
    netOutHistory: Array(HISTORY_LEN).fill(0),
    swapHistory: Array(HISTORY_LEN).fill(0),
    diskHistory: Array(HISTORY_LEN).fill(0),
    tcpHistory: Array(HISTORY_LEN).fill(0),
    udpHistory: Array(HISTORY_LEN).fill(0),
    processesHistory: Array(HISTORY_LEN).fill(0),
    latencyHistory: Array.from({ length: LATENCY_HISTORY_LEN }, () => ({
      ms: 0,
      t: 0,
    })),
  };
}

export type HistorySample = {
  cpu: number;
  memPercent: number;
  netIn: number;
  netOut: number;
  swapPercent: number;
  diskPercent: number;
  tcp: number;
  udp: number;
  processes: number;
  latency: number;
  latencyAt: number;
};

function shiftLatencyHistory(
  base: LatencySample[],
  sample: LatencySample,
): LatencySample[] {
  const next = [...base.slice(1), sample];
  return next.length > LATENCY_HISTORY_LEN
    ? next.slice(-LATENCY_HISTORY_LEN)
    : next;
}

export function pushHistory(
  prev: NodeHistoryBuffers | undefined,
  sample: HistorySample,
  online: boolean,
): NodeHistoryBuffers {
  const base = prev ?? emptyHistory();
  if (!online) {
    const zero = 0;
    const emptyLatency: LatencySample = { ms: 0, t: sample.latencyAt };
    return {
      cpuHistory: [...base.cpuHistory.slice(1), zero],
      memHistory: [...base.memHistory.slice(1), zero],
      netInHistory: [...base.netInHistory.slice(1), zero],
      netOutHistory: [...base.netOutHistory.slice(1), zero],
      swapHistory: [...base.swapHistory.slice(1), zero],
      diskHistory: [...base.diskHistory.slice(1), zero],
      tcpHistory: [...base.tcpHistory.slice(1), zero],
      udpHistory: [...base.udpHistory.slice(1), zero],
      processesHistory: [...base.processesHistory.slice(1), zero],
      latencyHistory: shiftLatencyHistory(base.latencyHistory, emptyLatency),
    };
  }
  const latencyPoint: LatencySample = {
    ms: sample.latency,
    t: sample.latencyAt,
  };
  return {
    cpuHistory: [...base.cpuHistory.slice(1), sample.cpu],
    memHistory: [...base.memHistory.slice(1), sample.memPercent],
    netInHistory: [...base.netInHistory.slice(1), sample.netIn],
    netOutHistory: [...base.netOutHistory.slice(1), sample.netOut],
    swapHistory: [...base.swapHistory.slice(1), sample.swapPercent],
    diskHistory: [...base.diskHistory.slice(1), sample.diskPercent],
    tcpHistory: [...base.tcpHistory.slice(1), sample.tcp],
    udpHistory: [...base.udpHistory.slice(1), sample.udp],
    processesHistory: [...base.processesHistory.slice(1), sample.processes],
    latencyHistory: shiftLatencyHistory(base.latencyHistory, latencyPoint),
  };
}

export function mapKomariNodeToVps(
  node: NodeBasicInfo,
  live: LiveRecord | undefined,
  online: boolean,
  history: NodeHistoryBuffers,
  latency = 0,
): VPSNode {
  const memoryTotal = bytesToGb(node.mem_total);
  const swapTotal = bytesToGb(node.swap_total);
  const diskTotal = bytesToGb(node.disk_total);

  const cpuUsage = online ? (live?.cpu.usage ?? 0) : 0;
  const memoryUsed = online ? bytesToGb(live?.ram.used ?? 0) : 0;
  const netSpeedIn = online ? bytesPerSecToKbps(live?.network.down ?? 0) : 0;
  const netSpeedOut = online ? bytesPerSecToKbps(live?.network.up ?? 0) : 0;
  const swapUsed = online
    ? resolveSwapUsedGb(live?.swap.used, swapTotal)
    : 0;
  const diskUsed = online
    ? resolveDiskUsedGb(live?.disk.used, diskTotal)
    : 0;

  const group = node.group?.trim() || "";

  return {
    id: node.uuid,
    name: node.name,
    provider: "",
    location: group || node.region || "—",
    flag: node.region || "🌐",
    os: node.os,
    arch: node.arch,
    virtualization: node.virtualization,
    kernelVersion: node.kernel_version,
    gpuName: node.gpu_name,
    clientVersion: node.version,
    createdAt: node.created_at,
    updatedAt:
      online && live?.updated_at != null && live.updated_at !== ""
        ? live.updated_at
        : node.updated_at,
    online,
    uptimeSec: online && live ? (live.uptime ?? 0) : 0,
    cpuCores: node.cpu_cores,
    cpuVendor: node.cpu_name,
    cpuUsage,
    load5:
      online && live ? formatLoadAverage(live.load.load1) : "—",
    loadAvg:
      online && live
        ? [
            formatLoadAverage(live.load.load1),
            formatLoadAverage(live.load.load5),
            formatLoadAverage(live.load.load15),
          ].join(" / ")
        : "—",
    systemLoad1: online && live ? live.load.load1 : 0,
    memoryTotal,
    memoryUsed,
    swapTotal,
    swapUsed,
    diskTotal,
    diskUsed,
    bandwidthTotal: resolveTrafficLimitGb(node),
    bandwidthUsedIn: online ? bytesToGb(live?.network.totalDown ?? 0) : 0,
    bandwidthUsedOut: online ? bytesToGb(live?.network.totalUp ?? 0) : 0,
    trafficLimitType: node.traffic_limit_type,
    netSpeedIn,
    netSpeedOut,
    latency,
    price: node.price,
    currency: node.currency,
    billingCycle: node.billing_cycle,
    autoRenewal: node.auto_renewal,
    expiredAt: node.expired_at,
    nodeGroup: group,
    tags: node.tags ?? "",
    publicRemark: node.public_remark?.trim() ?? "",
    privateRemark: node.remark?.trim() ?? "",
    cpuHistory: history.cpuHistory,
    memHistory: history.memHistory,
    netInHistory: history.netInHistory,
    netOutHistory: history.netOutHistory,
    swapHistory: history.swapHistory,
    diskHistory: history.diskHistory,
    tcpConnections: online ? (live?.connections.tcp ?? 0) : 0,
    udpConnections: online ? (live?.connections.udp ?? 0) : 0,
    processesCount: online ? (live?.process ?? 0) : 0,
    tcpHistory: history.tcpHistory,
    udpHistory: history.udpHistory,
    processesHistory: history.processesHistory,
    latencyHistory: history.latencyHistory,
  };
}

export function sortNodesByPolicy<T extends { uuid: string; weight: number }>(
  nodes: T[],
  onlineSet: Set<string>,
  offlinePosition?: string,
): T[] {
  const sortFn = (a: T, b: T) => {
    const aOnline = onlineSet.has(a.uuid);
    const bOnline = onlineSet.has(b.uuid);

    if (offlinePosition === "First") {
      if (!aOnline && bOnline) return -1;
      if (aOnline && !bOnline) return 1;
    } else if (offlinePosition !== "Keep") {
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
    }

    return a.weight - b.weight;
  };

  return [...nodes].sort(sortFn);
}
