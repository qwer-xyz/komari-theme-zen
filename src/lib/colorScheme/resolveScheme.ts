import { COLOR_PRESETS } from "./presets";
import type {
  ColorPresetId,
  ColorSchemeOverrides,
  ModeColorTokens,
  ResolvedColorVars,
} from "./tokens";
import {
  CSS_VAR_KEYS,
  DEFAULT_PRESET_ID,
} from "./tokens";

export type ResolveColorSchemeInput = {
  presetId: ColorPresetId;
  mode: "light" | "dark";
  overrides?: ColorSchemeOverrides;
};

type Rgb = { r: number; g: number; b: number };

function parseRgb(hex: string, fallback: Rgb): Rgb | null {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!match) return null;
  const value = match[1];
  const color = {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
  const alpha = match[2] ? parseInt(match[2], 16) / 255 : 1;
  return {
    r: color.r * alpha + fallback.r * (1 - alpha),
    g: color.g * alpha + fallback.g * (1 - alpha),
    b: color.b * alpha + fallback.b * (1 - alpha),
  };
}

function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

function toHex(color: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

export function ensureTextContrast(
  foreground: string,
  backgrounds: string[],
  mode: "light" | "dark",
  minimum = 4.5,
): string {
  const fallback = mode === "dark"
    ? { r: 0, g: 0, b: 0 }
    : { r: 255, g: 255, b: 255 };
  const color = parseRgb(foreground, fallback);
  const surfaces = backgrounds
    .map((background) => parseRgb(background, fallback))
    .filter((value): value is Rgb => value !== null);
  if (!color || surfaces.length === 0) return foreground;
  const minContrast = (candidate: Rgb) =>
    Math.min(...surfaces.map((surface) => contrastRatio(candidate, surface)));
  if (minContrast(color) >= minimum) return foreground;

  const targets = [
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
  ];
  let best = color;
  let bestScore = minContrast(color);
  let nearestPassing: { color: Rgb; distance: number } | null = null;

  // Contrast depends on relative luminance. Sampling both directions covers
  // the usable luminance interval even when one surface is dark and another
  // is light, a case where a one-direction binary search can never converge.
  for (const target of targets) {
    for (let step = 1; step <= 512; step += 1) {
      const candidate = mix(color, target, step / 512);
      const score = minContrast(candidate);
      const distance =
        (candidate.r - color.r) ** 2 +
        (candidate.g - color.g) ** 2 +
        (candidate.b - color.b) ** 2;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
      if (
        score >= minimum &&
        (!nearestPassing || distance < nearestPassing.distance)
      ) {
        nearestPassing = { color: candidate, distance };
      }
    }
  }

  return toHex(nearestPassing?.color ?? best);
}

function modeTokensToVars(tokens: ModeColorTokens): ResolvedColorVars {
  return {
    [CSS_VAR_KEYS.bg]: tokens.bg,
    [CSS_VAR_KEYS.surface]: tokens.surface,
    [CSS_VAR_KEYS.fg]: tokens.fg,
    [CSS_VAR_KEYS.fgStrong]: tokens.fgStrong,
    [CSS_VAR_KEYS.fgMuted]: tokens.fgMuted,
    [CSS_VAR_KEYS.fgSubtle]: tokens.fgSubtle,
    [CSS_VAR_KEYS.fgFaint]: tokens.fgFaint,
    [CSS_VAR_KEYS.elevate]: tokens.elevate,
    [CSS_VAR_KEYS.line]: tokens.line,
    [CSS_VAR_KEYS.lineStrong]: tokens.lineStrong,
    [CSS_VAR_KEYS.border]: tokens.border,
    [CSS_VAR_KEYS.borderMuted]: tokens.borderMuted,
    [CSS_VAR_KEYS.fillMuted]: tokens.fillMuted,
    [CSS_VAR_KEYS.accent]: tokens.accent,
    [CSS_VAR_KEYS.accentMuted]: tokens.accentMuted,
    [CSS_VAR_KEYS.success]: tokens.success,
    [CSS_VAR_KEYS.warning]: tokens.warning,
    [CSS_VAR_KEYS.danger]: tokens.danger,
  };
}

export function normalizePresetId(raw: unknown): ColorPresetId {
  if (typeof raw !== "string") return DEFAULT_PRESET_ID;
  const id = raw.trim() as ColorPresetId;
  return id in COLOR_PRESETS ? id : DEFAULT_PRESET_ID;
}

export function resolveColorScheme({
  presetId,
  mode,
  overrides = {},
}: ResolveColorSchemeInput): ResolvedColorVars {
  const preset = COLOR_PRESETS[presetId] ?? COLOR_PRESETS[DEFAULT_PRESET_ID];
  const modeTokens: ModeColorTokens = {
    ...(mode === "dark" ? preset.dark : preset.light),
  };

  if (mode === "light") {
    if (overrides.bgLight) modeTokens.bg = overrides.bgLight;
    if (overrides.surfaceLight) modeTokens.surface = overrides.surfaceLight;
    if (overrides.accentLight) {
      modeTokens.accent = overrides.accentLight;
      modeTokens.success = overrides.accentLight;
    }
  } else {
    if (overrides.bgDark) modeTokens.bg = overrides.bgDark;
    if (overrides.surfaceDark) modeTokens.surface = overrides.surfaceDark;
    if (overrides.accentDark) {
      modeTokens.accent = overrides.accentDark;
      modeTokens.success = overrides.accentDark;
    }
  }

  const textSurfaces = [modeTokens.bg, modeTokens.surface];
  for (const key of [
    "fg",
    "fgStrong",
    "fgMuted",
    "fgSubtle",
    "fgFaint",
    "accent",
    "accentMuted",
    "success",
    "warning",
    "danger",
  ] as const) {
    modeTokens[key] = ensureTextContrast(
      modeTokens[key],
      textSurfaces,
      mode,
    );
  }

  const vars = modeTokensToVars(modeTokens);

  const chartColor = (color: string) =>
    ensureTextContrast(color, textSurfaces, mode, 3);
  vars[CSS_VAR_KEYS.chartCpu] = chartColor(preset.charts.chartCpu);
  vars[CSS_VAR_KEYS.chartMem] = chartColor(preset.charts.chartMem);
  vars[CSS_VAR_KEYS.chartSwap] = chartColor(preset.charts.chartSwap);
  vars[CSS_VAR_KEYS.chartLoad] = chartColor(preset.charts.chartLoad);
  vars[CSS_VAR_KEYS.chartNetIn] = chartColor(preset.charts.chartNetIn);
  vars[CSS_VAR_KEYS.chartNetOut] = chartColor(preset.charts.chartNetOut);
  vars[CSS_VAR_KEYS.chartTcp] = chartColor(preset.charts.chartTcp);
  vars[CSS_VAR_KEYS.chartUdp] = chartColor(preset.charts.chartUdp);

  return vars;
}
