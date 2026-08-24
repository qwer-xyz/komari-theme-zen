/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { useEffect, useRef, useState } from "react";
import type { VPSNode } from "@/types";

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
const LIVE_INTERVAL_MS = 2000;

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
 * Accumulates a rolling buffer of live samples from the (2s-polled) node,
 * sampled on a steady internal cadence so the buffer fills regardless of how
 * React memoizes the node object. Resets when the node changes.
 */
export function useLiveSeries(
  node: VPSNode | undefined,
  enabled: boolean,
  capacity = LIVE_WINDOW_POINTS,
): LiveSample[] {
  const [samples, setSamples] = useState<LiveSample[]>([]);
  const nodeRef = useRef(node);
  nodeRef.current = node;

  const nodeId = node?.id;

  useEffect(() => {
    setSamples([]);
  }, [nodeId]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      const n = nodeRef.current;
      if (!n || !n.online) return;
      setSamples((prev) => {
        const base =
          prev.length >= capacity ? prev.slice(prev.length - capacity + 1) : prev;
        return [...base, sampleFromNode(n, Date.now())];
      });
    };

    tick();
    const id = window.setInterval(tick, LIVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, nodeId, capacity]);

  return samples;
}
