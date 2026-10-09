import type { LiveRecord } from "@/types/LiveData";
import { finiteNumber, nonNegativeNumber } from "@/lib/numeric";

export type LiveGpu = NonNullable<LiveRecord["gpu"]>;
export type LiveGpuDevice = LiveGpu["detailed_info"][number];

function toDevice(value: unknown): LiveGpuDevice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const device = value as Record<string, unknown>;
  return {
    name: typeof device.name === "string" ? device.name : "",
    // Bytes, the same unit the load records store GPU memory in.
    memory_total: nonNegativeNumber(device.memory_total),
    memory_used: nonNegativeNumber(device.memory_used),
    utilization: nonNegativeNumber(device.utilization),
    temperature: finiteNumber(device.temperature),
  };
}

function toDevices(value: unknown): LiveGpuDevice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((device) => {
    const parsed = toDevice(device);
    return parsed ? [parsed] : [];
  });
}

/**
 * Komari 1.5+ reports GPU as flat fields on the node status
 * (`gpu_count` / `gpu_average_usage` / `gpu_detailed_info`); earlier builds
 * nested the same shape under `gpu`, and before 1.5 `gpu` was a flat usage
 * number that stayed 0 whether or not the node had a card.
 *
 * `gpu` keeps being sent as 0 for nodes without a GPU, so presence has to come
 * from the fields that actually carry device detail.
 */
export function parseLiveGpu(
  source: Record<string, unknown>,
): LiveGpu | undefined {
  const raw = source.gpu;
  const nested =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : undefined;

  const detailed_info = toDevices(
    nested ? nested.detailed_info : source.gpu_detailed_info,
  );
  const count = Math.max(
    Math.floor(nonNegativeNumber(nested ? nested.count : source.gpu_count)),
    detailed_info.length,
  );
  // `gpu_average_usage` is omitted when it is exactly 0, so the float32 `gpu`
  // field stays as the fallback for an idle card.
  const average_usage = nonNegativeNumber(
    nested ? nested.average_usage : (source.gpu_average_usage ?? raw),
  );

  if (count === 0 && detailed_info.length === 0 && average_usage === 0) {
    return undefined;
  }
  return { count, average_usage, detailed_info };
}

/**
 * Matches live per-card readings onto a load record's device by index.
 * The backend derives a record's `device_index` from the position of the card
 * in the report, so both sides count devices the same way.
 */
export function liveGpuDeviceAt(
  gpu: LiveGpu | undefined,
  deviceIndex: number,
): LiveGpuDevice | undefined {
  if (!gpu || !Number.isInteger(deviceIndex) || deviceIndex < 0) return undefined;
  return gpu.detailed_info[deviceIndex];
}

export type GpuReading = {
  memUsed: number; // bytes
  memTotal: number; // bytes
  temperature: number; // °C
};

/** The stored fields a reading is built from; gap markers carry nulls. */
export type RecordedGpuReading = {
  mem_used?: number | null;
  mem_total?: number | null;
  temperature?: number | null;
};

/**
 * Picks the freshest reading for one card: the live sample when the agent
 * reports one, otherwise the newest stored record. Both sources measure memory
 * in bytes, so the two are interchangeable here.
 */
export function resolveGpuReading(
  live: LiveGpuDevice | undefined,
  recorded: RecordedGpuReading | undefined,
): GpuReading | undefined {
  // A card always has VRAM, so a live sample without a total is unusable and
  // the stored record is the better answer.
  if (live && live.memory_total > 0) {
    return {
      memUsed: live.memory_used,
      memTotal: live.memory_total,
      temperature: live.temperature,
    };
  }
  if (recorded) {
    return {
      memUsed: nonNegativeNumber(recorded.mem_used),
      memTotal: nonNegativeNumber(recorded.mem_total),
      temperature: finiteNumber(recorded.temperature),
    };
  }
  return undefined;
}
