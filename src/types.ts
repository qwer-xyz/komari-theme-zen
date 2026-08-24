/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import type { LatencySample } from "@/lib/latencyDisplay";

export type { LatencySample };

export interface VPSNode {
  id: string;
  name: string;
  provider: string;
  location: string;
  flag: string;
  os: string;
  arch: string;
  virtualization: string;
  kernelVersion: string;
  gpuName: string;
  clientVersion: string;
  createdAt: string | number;
  updatedAt: string | number;
  online: boolean;
  uptimeSec: number;
  cpuCores: number;
  cpuVendor: string;
  cpuUsage: number; // Current CPU % (0 - 100)
  load5: string; // 1-minute load average, e.g. "0.30"
  loadAvg: string; // 1 / 5 / 15-minute load averages, e.g. "0.30 / 0.25 / 0.20"
  systemLoad1: number;
  memoryTotal: number; // in GB
  memoryUsed: number;  // in GB
  swapTotal: number;   // in GB
  swapUsed: number;    // in GB
  diskTotal: number;   // in GB
  diskUsed: number;    // in GB
  bandwidthTotal: number; // traffic limit in GB (0 = unlimited)
  bandwidthUsedIn: number; // cumulative download in GB
  bandwidthUsedOut: number; // cumulative upload in GB
  trafficLimitType?: "sum" | "max" | "min" | "up" | "down";
  netSpeedIn: number;  // current KB/s incoming
  netSpeedOut: number; // current KB/s outgoing
  latency: number;     // ping latency in ms
  latencyHistory: LatencySample[];
  price: number;
  currency: string;
  billingCycle: number;
  autoRenewal?: boolean;
  expiredAt: string;
  nodeGroup: string; // Komari API `group` field (user-defined, shown as-is)
  tags: string; // semicolon-separated, optional `<color>` suffix per tag
  publicRemark: string; // public_remark from API — visible to guests
  privateRemark: string; // remark from API — admin session only
  cpuHistory: number[]; // last 20 ticks
  memHistory: number[]; // last 20 ticks
  netInHistory: number[]; // last 20 ticks
  netOutHistory: number[]; // last 20 ticks
  swapHistory?: number[];
  diskHistory?: number[];
  tcpConnections: number;
  udpConnections: number;
  processesCount: number;
  tcpHistory: number[];
  udpHistory: number[];
  processesHistory: number[];
}
