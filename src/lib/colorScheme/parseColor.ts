const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Validate and normalize #RGB / #RRGGBB / #RRGGBBAA; returns null if invalid. */
export function parseHexColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!HEX_RE.test(trimmed)) return null;
  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function parseOptionalHex(raw: unknown): string | undefined {
  const parsed = parseHexColor(raw);
  return parsed ?? undefined;
}
