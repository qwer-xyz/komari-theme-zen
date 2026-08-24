import React from "react";
import { useRPC2Call } from "./RPC2Context";

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
  ipv4?: string;
  ipv6?: string;
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

  const refresh = () => {
    setError(null);
    call<unknown, Record<string, Record<string, unknown>>>(
      "common:getNodes",
      undefined,
      { timeout: 15000 },
    )
      .then((result) => {
        if (!result || typeof result !== "object") {
          setNodeList([]);
          return;
        }

        const list: NodeBasicInfo[] = Object.values(result).map((raw) => {
          const n = raw as Record<string, unknown>;
          return {
          uuid: String(n.uuid ?? ""),
          name: String(n.name ?? ""),
          cpu_name: String(n.cpu_name ?? ""),
          virtualization: String(n.virtualization ?? ""),
          arch: String(n.arch ?? ""),
          cpu_cores: Number(n.cpu_cores ?? 0),
          os: String(n.os ?? ""),
          kernel_version: String(n.kernel_version ?? ""),
          gpu_name: String(n.gpu_name ?? ""),
          region: String(n.region ?? ""),
          mem_total: Number(n.mem_total ?? 0),
          swap_total: Number(n.swap_total ?? 0),
          disk_total: Number(n.disk_total ?? 0),
          version: String(n.version ?? ""),
          weight: Number(n.weight ?? 0),
          price: Number(n.price ?? 0),
          tags: String(n.tags ?? ""),
          billing_cycle: Number(n.billing_cycle ?? 0),
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
          traffic_limit: Number(n.traffic_limit ?? 0),
          traffic_limit_type: n.traffic_limit_type as NodeBasicInfo["traffic_limit_type"],
          expired_at: String(n.expired_at ?? ""),
          created_at: String(n.created_at ?? ""),
          updated_at: String(n.updated_at ?? ""),
          ipv4: n.ipv4 ? String(n.ipv4) : undefined,
          ipv6: n.ipv6 ? String(n.ipv6) : undefined,
          };
        });
        setNodeList(list);
      })
      .catch((err: Error) => {
        setError(err?.message || "An error occurred while fetching data");
        setNodeList([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  React.useEffect(() => {
    refresh();
  }, []);

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
