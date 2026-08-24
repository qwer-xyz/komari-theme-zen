import type { Messages } from "@/lib/i18n";

/** Round preset hours to whole days when >= 24h; otherwise keep hour precision. */
export function roundHoursForPreset(hours: number, maxHours: number): number {
  const capped = Math.max(1, Math.min(maxHours, Math.round(hours)));
  if (capped >= 24) {
    const days = Math.round(capped / 24);
    return Math.min(maxHours, Math.max(24, days * 24));
  }
  return capped;
}

/**
 * Build time-range preset values (in hours) from backend max preserve time.
 * - max = 1h → [1]
 * - max ≤ 4h → [1, max]
 * - 4h < max ≤ 24h → four quarter points (hours)
 * - max > 24h → [1d, …quarters rounded to whole days…, max rounded to whole days]
 */
export function buildPreserveHourPresets(maxHours: number): number[] {
  if (maxHours <= 0) return [];
  const max = Math.max(1, Math.floor(maxHours));

  if (max === 1) return [1];

  if (max <= 4) {
    return [...new Set([1, max])].sort((a, b) => a - b);
  }

  if (max <= 24) {
    const raw = Array.from({ length: 4 }, (_, i) =>
      Math.max(1, Math.round((max * (i + 1)) / 4)),
    );
    return [...new Set(raw)].sort((a, b) => a - b);
  }

  const raw = [
    24,
    roundHoursForPreset(max / 4, max),
    roundHoursForPreset(max / 2, max),
    roundHoursForPreset(max, max),
  ];
  return [...new Set(raw.map((h) => Math.min(max, Math.max(1, h))))].sort(
    (a, b) => a - b,
  );
}

export function formatPreserveHoursLabel(
  hours: number,
  messages: Messages,
): string {
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return `${days}${messages.unitDay}`;
  }
  return `${hours}${messages.unitHour}`;
}

function formatMinutesAgo(totalMinutes: number, messages: Messages): string {
  if (totalMinutes <= 0) return messages.timeNow;

  const days = Math.floor(totalMinutes / (24 * 60));
  const rem = totalMinutes % (24 * 60);
  const hrs = Math.floor(rem / 60);
  const mins = rem % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}${messages.unitDay}`);
  if (hrs > 0) parts.push(`${hrs}${messages.unitHour}`);
  if (mins > 0) parts.push(`${mins}${messages.unitMin}`);

  return parts.length > 0 ? `-${parts.join("")}` : messages.timeNow;
}

/** Chart hover / tooltip offset from the right edge of the series. */
export function formatChartOffsetLabel(
  indexFromEnd: number,
  hours: number,
  dataLength: number,
  messages: Messages,
): string {
  if (indexFromEnd === 0) return messages.timeNow;

  const totalMs = hours * 3600 * 1000;
  const stepMs = dataLength > 1 ? totalMs / (dataLength - 1) : totalMs;
  const offsetMs = indexFromEnd * stepMs;
  const totalMinutes = Math.round(offsetMs / 60000);

  return formatMinutesAgo(totalMinutes, messages);
}

/** Point-in-time label for chart scrub tooltips. */
export function formatChartPointTime(iso: string, rangeHours: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  if (rangeHours > 24) {
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${minute}`;
  }

  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function hoursToChartLength(hours: number): number {
  if (hours >= 24) return 97;
  if (hours >= 12) return 85;
  if (hours >= 6) return 72;
  return 60;
}
