import React from "react";
import { useRPC2Call } from "./RPC2Context";
import { finiteNumber, nonNegativeNumber } from "@/lib/numeric";

export type NodeBasicInfo = {
  uuid: string;
  name: string;
  cpu_name: string;
  virtualization: string;
  arch: string;
  cpu_cores: number;
  os: string;
  kernel_version: string;
  gpu_name: string;
  region: string;
  mem_total: number;
  swap_total: number;
  disk_total: number;
  version: string;
  weight: number;
  price: number;
  tags: string;
  billing_cycle: number;
  auto_renewal?: boolean;
  currency: string;
  group: string;
  remark: string;
  public_remark: string;
  traffic_limit: number;
  traffic_limit_type: undefined | "sum" | "max" | "min" | "up" | "down";
  expired_at: string;
  created_at: string;
  updated_at: string;
};

interface NodeListContextType {
  nodeList: NodeBasicInfo[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const NodeListContext = React.createContext<NodeListContextType | undefined>(
  undefined,
);

export const NodeListProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [nodeList, setNodeList] = React.useState<NodeBasicInfo[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { call } = useRPC2Call();
  const runningRef = React.useRef(false);
  const hasLoadedRef = React.useRef(false);
  const lastSuccessAtRef = React.useRef(0);

  const refresh = React.useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(null);
    if (!hasLoadedRef.current) setIsLoading(true);
    call<unknown, Record<string, Record<string, unknown>>>(
      "common:getNodes",
      undefined,
      { timeout: 15000 },
    )
      .then((result) => {
        if (!result || typeof result !== "object" || Array.isArray(result)) {
          throw new Error("Invalid node list response");
        }

        const seen = new Set<string>();
        const list: NodeBasicInfo[] = Object.values(result).flatMap((raw) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
          const n = raw as Record<string, unknown>;
          const uuid = String(n.uuid ?? "").trim();
          if (!uuid || seen.has(uuid)) return [];
          seen.add(uuid);

          const trafficLimitType = ["sum", "max", "min", "up", "down"].includes(
            String(n.traffic_limit_type),
          )
            ? (String(n.traffic_limit_type) as NodeBasicInfo["traffic_limit_type"])
            : undefined;

          return [{
          uuid,
          name: String(n.name ?? ""),
          cpu_name: String(n.cpu_name ?? ""),
          virtualization: String(n.virtualization ?? ""),
          arch: String(n.arch ?? ""),
          cpu_cores: nonNegativeNumber(n.cpu_cores),
          os: String(n.os ?? ""),
          kernel_version: String(n.kernel_version ?? ""),
          gpu_name: String(n.gpu_name ?? ""),
          region: String(n.region ?? ""),
          mem_total: nonNegativeNumber(n.mem_total),
          swap_total: nonNegativeNumber(n.swap_total),
          disk_total: nonNegativeNumber(n.disk_total),
          version: String(n.version ?? ""),
          weight: finiteNumber(n.weight),
          // Komari uses -1 sentinels for free / one-time billing semantics.
          price: finiteNumber(n.price),
          tags: String(n.tags ?? ""),
          billing_cycle: finiteNumber(n.billing_cycle),
          auto_renewal:
            typeof n.auto_renewal === "boolean"
              ? n.auto_renewal
              : typeof n.autoRenewal === "boolean"
                ? n.autoRenewal
                : undefined,
          currency: String(n.currency ?? ""),
          group: String(n.group ?? ""),
          remark: String(n.remark ?? ""),
          public_remark: String(n.public_remark ?? ""),
          traffic_limit: nonNegativeNumber(n.traffic_limit),
          traffic_limit_type: trafficLimitType,
          expired_at: String(n.expired_at ?? ""),
          created_at: String(n.created_at ?? ""),
          updated_at: String(n.updated_at ?? ""),
          }];
        });
        setNodeList(list);
        hasLoadedRef.current = true;
        lastSuccessAtRef.current = Date.now();
      })
      .catch((err: Error) => {
        setError(err?.message || "An error occurred while fetching data");
      })
      .finally(() => {
        runningRef.current = false;
        setIsLoading(false);
      });
  }, [call]);

  React.useEffect(() => {
    refresh();
    const interval = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 5 * 60_000);
    const onVisibilityChange = () => {
      if (
        !document.hidden &&
        Date.now() - lastSuccessAtRef.current > 60_000
      ) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  return (
    <NodeListContext.Provider value={{ nodeList, isLoading, error, refresh }}>
      {children}
    </NodeListContext.Provider>
  );
};

export const useNodeList = () => {
  const context = React.useContext(NodeListContext);
  if (!context) {
    throw new Error("useNodeList must be used within a NodeListProvider");
  }
  return context;
};
