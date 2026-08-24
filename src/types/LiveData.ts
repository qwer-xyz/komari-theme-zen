export type LiveData = {
  online: string[];
  data: { [key: string]: LiveRecord };
};

export type LivePingStat = {
  name?: string;
  latest?: number;
  avg?: number;
  loss?: number;
  min?: number;
  max?: number;
  tail?: number;
};

export type LiveRecord = {
  cpu: {
    usage: number;
  };
  ram: {
    used: number;
    total?: number;
  };
  swap: {
    used: number;
    total?: number;
  };
  load: {
    load1: number;
    load5: number;
    load15: number;
  };
  disk: {
    used: number;
    total?: number;
  };
  network: {
    up: number;
    down: number;
    totalUp: number;
    totalDown: number;
  };
  connections: {
    tcp: number;
    udp: number;
  };
  gpu?: {
    count: number;
    average_usage: number;
    detailed_info: {
      name: string;
      memory_total: number;
      memory_used: number;
      utilization: number;
      temperature: number;
    }[];
  };
  uptime: number;
  process: number;
  message: string;
  updated_at: string | number;
  /** Present on Komari versions that embed ping stats in getNodesLatestStatus. */
  ping?: Record<string, LivePingStat>;
};

export type LiveDataResponse = {
  data: LiveData;
  status: string;
};
