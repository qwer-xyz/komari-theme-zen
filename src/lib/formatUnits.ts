/** Format bytes per second with adaptive B/KB/MB/GB unit (matches official formatBytes tiers). */
export function formatBytesPerSec(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) {
    return "0 B/S";
  }
  const units = ["B/S", "KB/S", "MB/S", "GB/S"];
  let size = bytesPerSec;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  if (unitIndex === 0) {
    return `${Math.round(size)} ${units[unitIndex]}`;
  }
  if (unitIndex >= 2) {
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
  if (size > 99.99) {
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/** Format KB/s (legacy live fields) with adaptive unit. */
export function formatKbps(kbps: number): string {
  return formatBytesPerSec(kbps * 1024);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}

export type SpeedScale = {
  divisor: number;
  suffix: string;
};

/** Pick chart scale for bytes/s series so Y-axis labels stay readable. */
export function pickSpeedScale(maxBytesPerSec: number): SpeedScale {
  if (maxBytesPerSec >= 1024 ** 3) {
    return { divisor: 1024 ** 3, suffix: " GB/S" };
  }
  if (maxBytesPerSec >= 1024 ** 2) {
    return { divisor: 1024 ** 2, suffix: " MB/S" };
  }
  if (maxBytesPerSec >= 1024) {
    return { divisor: 1024, suffix: " KB/S" };
  }
  return { divisor: 1, suffix: " B/S" };
}

export function scaleSpeedValue(bytesPerSec: number, scale: SpeedScale): number {
  return bytesPerSec / scale.divisor;
}

export function formatSpeedAxisMax(maxBytesPerSec: number): string {
  const scale = pickSpeedScale(maxBytesPerSec);
  const val = scaleSpeedValue(maxBytesPerSec, scale);
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(1)}${scale.suffix}`;
}

export type TrafficLimitType = "sum" | "max" | "min" | "up" | "down";

/**
 * Resolve billable used traffic (GB) per Komari `traffic_limit_type`:
 * - sum: 双向 — upload + download
 * - max: 取大 — max(upload, download)
 * - min: 取小 — min(upload, download)
 * - up: 上行 — upload only
 * - down: 下行 — download only
 */
export function resolveTrafficUsedGb(
  usedInGb: number,
  usedOutGb: number,
  type: TrafficLimitType | undefined,
): number {
  switch (type ?? "sum") {
    case "max":
      return Math.max(usedInGb, usedOutGb);
    case "min":
      return Math.min(usedInGb, usedOutGb);
    case "up":
      return usedOutGb;
    case "down":
      return usedInGb;
    case "sum":
    default:
      return usedInGb + usedOutGb;
  }
}

function formatTrafficAmount(gb: number): string {
  if (!Number.isFinite(gb) || gb <= 0) return "0";
  if (gb >= 100) return gb.toFixed(1);
  if (gb >= 10) return gb.toFixed(1);
  return gb.toFixed(2);
}

function formatTrafficMb(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) return "0 MB";
  const amount = formatTrafficAmount(mb);
  return amount === "0.00" ? "<0.01 MB" : `${amount} MB`;
}

/** Format a single traffic value, falling back before rounded values become 0.00. */
export function formatTrafficGb(gb: number): string {
  if (!Number.isFinite(gb) || gb <= 0) return "0 GB";
  if (gb >= 1024) {
    return `${formatTrafficAmount(gb / 1024)} TB`;
  }
  if (formatTrafficAmount(gb) === "0.00") {
    return formatTrafficMb(gb * 1024);
  }
  return `${formatTrafficAmount(gb)} GB`;
}

/** Format used/limit pair; each side keeps its own most readable unit. */
export function formatTrafficPair(usedGb: number, limitGb: number): string {
  return `${formatTrafficGb(usedGb)} / ${formatTrafficGb(limitGb)}`;
}

function formatStorageGb(gb: number): string {
  if (!Number.isFinite(gb) || gb <= 0) return "0 GB";
  return `${gb.toFixed(1)} GB`;
}

function formatStorageMb(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) return "0 MB";
  if (mb >= 100) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

/** Format used/total (GB). Both sides use MB when used and total are below 1 GB. */
export function formatStoragePair(usedGb: number, totalGb: number): string {
  if (usedGb < 1 && totalGb < 1) {
    return `${formatStorageMb(usedGb * 1024)} / ${formatStorageMb(totalGb * 1024)}`;
  }
  return `${formatStorageGb(usedGb)} / ${formatStorageGb(totalGb)}`;
}

/** Format "used / total with units (percent%)" for cluster resource summaries. */
export function formatResourceUsageSummary(
  usedGb: number,
  totalGb: number,
  percent: number,
  options?: { usedDigits?: number; totalDigits?: number; percentDigits?: number },
): string {
  const usedDigits = options?.usedDigits ?? 1;
  const totalDigits = options?.totalDigits ?? 0;
  const percentDigits = options?.percentDigits ?? 1;
  const pct = percent.toFixed(percentDigits);

  if (usedGb < 1 && totalGb < 1) {
    const usedMb = usedGb * 1024;
    const totalMb = totalGb * 1024;
    const fmtMb = (mb: number, digits: number) =>
      digits === 0 ? `${Math.round(mb)} MB` : `${mb.toFixed(digits)} MB`;
    return `${fmtMb(usedMb, usedDigits)} / ${fmtMb(totalMb, totalDigits)} (${pct}%)`;
  }

  return `${usedGb.toFixed(usedDigits)} GB / ${totalGb.toFixed(totalDigits)} GB (${pct}%)`;
}

/** Format "current / total" count ratio. */
export function formatCountRatio(current: number, total: number): string {
  return `${current} / ${total}`;
}

export function getTrafficTypeShortLabel(type: TrafficLimitType | undefined): string {
  switch (type ?? "sum") {
    case "max":
      return "MAX";
    case "min":
      return "MIN";
    case "up":
      return "OUT";
    case "down":
      return "IN";
    case "sum":
    default:
      return "SUM";
  }
}

export function getTrafficTypeLabel(type: TrafficLimitType | undefined): string {
  return getTrafficTypeShortLabel(type);
}

export type UptimeLabels = {
  day: string;
  hour: string;
  minute: string;
  second: string;
};

/** Komari live API returns uptime in seconds. */
export function formatUptime(
  seconds: number,
  labels: UptimeLabels,
): string {
  if (!seconds || seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d} ${labels.day}`);
  if (h) parts.push(`${h} ${labels.hour}`);
  if (m) parts.push(`${m} ${labels.minute}`);
  if (s || parts.length === 0) parts.push(`${s} ${labels.second}`);
  return parts.join(" ");
}

export function formatUpdatedAt(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null || raw === "") return "—";
  const ms =
    typeof raw === "number"
      ? raw < 1e12
        ? raw * 1000
        : raw
      : Number(raw);
  const d =
    typeof raw === "number" && Number.isFinite(ms)
      ? new Date(ms)
      : new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatNodeTraffic(
  node: {
    bandwidthUsedIn: number;
    bandwidthUsedOut: number;
    bandwidthTotal: number;
    trafficLimitType?: TrafficLimitType;
  },
): string {
  const used = resolveTrafficUsedGb(
    node.bandwidthUsedIn,
    node.bandwidthUsedOut,
    node.trafficLimitType,
  );
  if (node.bandwidthTotal <= 0) {
    return formatTrafficGb(used);
  }
  return formatTrafficPair(used, node.bandwidthTotal);
}
