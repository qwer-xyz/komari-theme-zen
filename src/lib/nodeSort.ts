import { formatNodeBilling, type BillingLabels } from "@/lib/billingDisplay";
import { resolveTrafficUsedGb } from "@/lib/formatUnits";
import type { VPSNode } from "@/types";

export type NodeSortField =
  | "default"
  | "status"
  | "name"
  | "os"
  | "cpu"
  | "mem"
  | "disk"
  | "bandwidth"
  | "traffic"
  | "latency"
  | "days";

export type NodeSortOrder = "asc" | "desc";

/** Maps admin theme config option strings to internal sort fields. */
export const NODE_SORT_FIELD_MAP: Record<string, NodeSortField> = {
  Default: "default",
  Name: "name",
  CPU: "cpu",
  Memory: "mem",
  Disk: "disk",
  Bandwidth: "bandwidth",
  Traffic: "traffic",
  Latency: "latency",
  Expiry: "days",
  Status: "status",
  OS: "os",
};

export function sortNodeList(
  nodes: VPSNode[],
  sortField: NodeSortField,
  sortOrder: NodeSortOrder,
  billingLabels: BillingLabels,
): VPSNode[] {
  if (sortField === "default") return nodes;

  return [...nodes].sort((a, b) => {
    if (a.online !== b.online) {
      return a.online ? -1 : 1;
    }

    let valA: string | number = "";
    let valB: string | number = "";

    switch (sortField) {
      case "status":
        valA = a.online ? 1 : 0;
        valB = b.online ? 1 : 0;
        break;
      case "name":
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        break;
      case "os":
        valA = a.os.toLowerCase();
        valB = b.os.toLowerCase();
        break;
      case "cpu":
        valA = a.online ? a.cpuUsage : -1;
        valB = b.online ? b.cpuUsage : -1;
        break;
      case "mem":
        valA = a.online ? a.memoryUsed / a.memoryTotal : -1;
        valB = b.online ? b.memoryUsed / b.memoryTotal : -1;
        break;
      case "disk":
        valA = a.online ? a.diskUsed / a.diskTotal : -1;
        valB = b.online ? b.diskUsed / b.diskTotal : -1;
        break;
      case "bandwidth":
        valA = a.online ? a.netSpeedIn + a.netSpeedOut : -1;
        valB = b.online ? b.netSpeedIn + b.netSpeedOut : -1;
        break;
      case "traffic":
        valA = resolveTrafficUsedGb(
          a.bandwidthUsedIn,
          a.bandwidthUsedOut,
          a.trafficLimitType,
        );
        valB = resolveTrafficUsedGb(
          b.bandwidthUsedIn,
          b.bandwidthUsedOut,
          b.trafficLimitType,
        );
        break;
      case "latency":
        valA = a.online ? a.latency : 99999;
        valB = b.online ? b.latency : 99999;
        break;
      case "days":
        valA = formatNodeBilling(
          {
            price: a.price,
            currency: a.currency,
            billingCycle: a.billingCycle,
            expiredAt: a.expiredAt,
          },
          billingLabels,
        ).daysRemaining;
        valB = formatNodeBilling(
          {
            price: b.price,
            currency: b.currency,
            billingCycle: b.billingCycle,
            expiredAt: b.expiredAt,
          },
          billingLabels,
        ).daysRemaining;
        break;
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
}
