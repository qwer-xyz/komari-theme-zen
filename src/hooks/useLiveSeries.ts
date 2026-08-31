/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { useEffect, useRef, useState } from "react";
import type { VPSNode } from "@/types";
import { timestampMs } from "@/lib/numeric";

export interface LiveSample {
  t: number;
  cpu: number; // %
  mem: number; // %
  swap: number; // %
  disk: number; // %
  netIn: number; // bytes/s
  netOut: number; // bytes/s
  tcp: number;
  udp: number;
  proc: number;
  load1: number;
}

/** Rolling window length (~5 min at a 2s cadence). */
export const LIVE_WINDOW_POINTS = 150;
function sampleFromNode(node: VPSNode, t: number): LiveSample {
  const pct = (used: number, total: number) =>
    total > 0 ? (used / total) * 100 : 0;
  return {
    t,
    cpu: node.cpuUsage ?? 0,
    mem: pct(node.memoryUsed, node.memoryTotal),
    swap: pct(node.swapUsed, node.swapTotal),
    disk: pct(node.diskUsed, node.diskTotal),
    // Live speeds are KB/s; history series are bytes/s.
    netIn: (node.netSpeedIn ?? 0) * 1024,
    netOut: (node.netSpeedOut ?? 0) * 1024,
    tcp: node.tcpConnections ?? 0,
    udp: node.udpConnections ?? 0,
    proc: node.processesCount ?? 0,
    load1: node.systemLoad1 ?? 0,
  };
}

/**
 * Accumulates only backend-originated samples. Repeated payloads do not create
 * synthetic points with a new browser timestamp.
 */
export function useLiveSeries(
  node: VPSNode | undefined,
  enabled: boolean,
  capacity = LIVE_WINDOW_POINTS,
): LiveSample[] {
  const [samples, setSamples] = useState<LiveSample[]>([]);
  const nodeId = node?.id;
  const lastSampleKeyRef = useRef("");

  useEffect(() => {
    setSamples([]);
    lastSampleKeyRef.current = "";
  }, [nodeId]);

  useEffect(() => {
    if (!enabled || !node || !node.online || document.hidden) return;

    const sourceTime = timestampMs(node.updatedAt);
    if (sourceTime === null) return;
    const sampleKey = [
      node.id,
      String(node.updatedAt),
      node.cpuUsage,
      node.memoryUsed,
      node.swapUsed,
      node.diskUsed,
      node.netSpeedIn,
      node.netSpeedOut,
      node.tcpConnections,
      node.udpConnections,
      node.processesCount,
      node.systemLoad1,
    ].join(":");
    if (lastSampleKeyRef.current === sampleKey) return;
    lastSampleKeyRef.current = sampleKey;

    setSamples((prev) => {
      const base =
        prev.length >= capacity ? prev.slice(prev.length - capacity + 1) : prev;
      return [...base, sampleFromNode(node, sourceTime)];
    });
  }, [enabled, node, capacity]);

  return samples;
}
