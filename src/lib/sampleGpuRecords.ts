export function sampleGpuRecords<
  T extends {
    time: string;
    utilization: number;
    mem_used: number;
    mem_total: number;
  },
>(records: T[], budget = 1000): T[] {
  if (records.length < 2) return records;
  const times = records.map((record) => Date.parse(record.time));
  const intervals = times
    .slice(1, 513)
    .map((time, i) => time - times[i])
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const gapLimit = Math.max(
    60_000,
    (intervals[intervals.length >> 1] ?? 60_000) * 5,
  );
  const gaps = times
    .map((time, i) => ({ index: i, duration: i ? time - times[i - 1] : 0 }))
    .filter((gap) => gap.duration > gapLimit)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, Math.floor(budget / 10));
  if (records.length <= budget && gaps.length === 0) return records;
  const selected = new Set<number>([0, records.length - 1]);
  const buckets = Math.max(
    1,
    Math.min(records.length, Math.floor((budget - 2 - gaps.length * 3) / 7)),
  );
  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = Math.floor((bucket * records.length) / buckets);
    const end = Math.floor(((bucket + 1) * records.length) / buckets);
    selected.add(start);
    selected.add(end - 1);
    const missing = records
      .slice(start, end)
      .findIndex(
        (record) => record.utilization == null || record.mem_used == null,
      );
    if (missing >= 0) selected.add(start + missing);
    for (const metric of [
      (r: T) => r.utilization,
      (r: T) => (r.mem_total > 0 ? r.mem_used / r.mem_total : NaN),
    ]) {
      let min = start,
        max = start;
      for (let i = start + 1; i < end; i++) {
        if (metric(records[i]) < metric(records[min])) min = i;
        if (metric(records[i]) > metric(records[max])) max = i;
      }
      selected.add(min);
      selected.add(max);
    }
  }
  for (const gap of gaps) {
    selected.add(gap.index - 1);
    selected.add(gap.index);
  }
  const result = [...selected].map((i) => records[i]);
  for (const gap of gaps)
    result.push({
      ...records[gap.index],
      time: new Date(times[gap.index - 1] + gap.duration / 2).toISOString(),
      utilization: null,
      mem_used: null,
      mem_total: null,
    });
  return result.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}
