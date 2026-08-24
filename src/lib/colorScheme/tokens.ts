export type ColorPresetId =
  | "Warm"
  | "Red"
  | "Yellow"
  | "Green"
  | "Blue"
  | "Purple"
  | "Mono";

export type ModeColorTokens = {
  bg: string;
  surface: string;
  fg: string;
  fgStrong: string;
  fgMuted: string;
  fgSubtle: string;
  fgFaint: string;
  elevate: string;
  line: string;
  lineStrong: string;
  border: string;
  borderMuted: string;
  fillMuted: string;
  accent: string;
  accentMuted: string;
  success: string;
  warning: string;
  danger: string;
};

export type ChartColorTokens = {
  chartCpu: string;
  chartMem: string;
  chartSwap: string;
  chartLoad: string;
  chartNetIn: string;
  chartNetOut: string;
  chartTcp: string;
  chartUdp: string;
};

export type ColorPreset = {
  light: ModeColorTokens;
  dark: ModeColorTokens;
  charts: ChartColorTokens;
};

/** Flat CSS custom-property map applied to :root / .dark. */
export type ResolvedColorVars = Record<string, string>;

export type ColorSchemeOverrides = {
  bgLight?: string;
  bgDark?: string;
  surfaceLight?: string;
  surfaceDark?: string;
  accentLight?: string;
  accentDark?: string;
};

export const CSS_VAR_KEYS = {
  bg: "--zen-bg",
  surface: "--zen-surface",
  fg: "--zen-fg",
  fgStrong: "--zen-fg-strong",
  fgMuted: "--zen-fg-muted",
  fgSubtle: "--zen-fg-subtle",
  fgFaint: "--zen-fg-faint",
  elevate: "--zen-elevate",
  line: "--zen-line",
  lineStrong: "--zen-line-strong",
  border: "--zen-border",
  borderMuted: "--zen-border-muted",
  fillMuted: "--zen-fill-muted",
  accent: "--zen-accent",
  accentMuted: "--zen-accent-muted",
  success: "--zen-success",
  warning: "--zen-warning",
  danger: "--zen-danger",
  chartCpu: "--zen-chart-cpu",
  chartMem: "--zen-chart-mem",
  chartSwap: "--zen-chart-swap",
  chartLoad: "--zen-chart-load",
  chartNetIn: "--zen-chart-net-in",
  chartNetOut: "--zen-chart-net-out",
  chartTcp: "--zen-chart-tcp",
  chartUdp: "--zen-chart-udp",
} as const;

export const DEFAULT_PRESET_ID: ColorPresetId = "Warm";

export const COLOR_PRESET_IDS: ColorPresetId[] = [
  "Warm",
  "Red",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Mono",
];
