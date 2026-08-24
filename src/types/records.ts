export type PingRecord = {
  client: string;
  task_id: number;
  time: string;
  value: number;
};

export type PingTaskInfo = {
  id: number;
  name: string;
  interval: number;
  loss: number;
  latest?: number;
  avg?: number;
  min?: number;
  max?: number;
  p50?: number;
  p99?: number;
  p99_p50_ratio?: number;
};

export type PingRecordsResponse = {
  count: number;
  records: PingRecord[];
  tasks?: PingTaskInfo[];
};

export type LoadRecord = {
  client: string;
  time: string;
  cpu: number | null;
  ram: number | null;
  ram_total: number | null;
  swap: number | null;
  swap_total: number | null;
  load: number | null;
  disk: number | null;
  disk_total: number | null;
  net_in: number | null;
  net_out: number | null;
  net_total_up: number | null;
  net_total_down: number | null;
  process: number | null;
  connections: number | null;
  connections_udp: number | null;
};

export type LoadRecordsResponse = {
  count: number;
  records: LoadRecord[];
};

export type MetricKey =
  | "cpu"
  | "mem"
  | "swap"
  | "disk"
  | "netin"
  | "netout"
  | "tcp"
  | "udp"
  | "processes"
  | "load1";
