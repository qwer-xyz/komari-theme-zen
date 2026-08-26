export type MetricPoint = {
  time: string;
  value: number | null;
  count?: number;
  tags?: Record<string, string>;
  labels?: Record<string, string>;
};

export type MetricSeries = {
  metric_key: string;
  entity_id: string;
  type?: string;
  unit?: string;
  tags?: Record<string, string>;
  downsampled?: boolean;
  interval_seconds?: number;
  count: number;
  points: MetricPoint[];
};

export type QueryMetricsResponse = {
  start: string;
  end: string;
  series: MetricSeries[];
  count: number;
};

export type PingMetricStat = {
  entity_id: string;
  task_id: string;
  name?: string;
  type?: string;
  interval?: number;
  total: number;
  valid: number;
  loss: number;
  loss_approximate?: boolean;
  min?: number;
  max?: number;
  avg?: number;
  latest?: number;
  p50?: number;
  p99?: number;
  stddev?: number;
  p99_p50_ratio: number;
};

export type PingMetricStatsResponse = {
  start: string;
  end: string;
  interval_seconds?: number;
  stats: PingMetricStat[];
  count: number;
};
