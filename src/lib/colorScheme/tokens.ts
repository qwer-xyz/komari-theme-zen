export type ColorPresetId = "Kumo" | "Anthropic" | "Carbon" | "Supabase";

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
  detail: {
    light: DetailColorTokens;
    dark: DetailColorTokens;
  };
};

export const DETAIL_CSS_VAR_KEYS = {
  detailBg: "--zen-detail-bg",
  card: "--zen-card",
  cardLine: "--zen-card-line",
  online: "--zen-online",
  onlineBg: "--zen-online-bg",
  chip: "--zen-chip",
  chipFg: "--zen-chip-fg",
  seriesCpu: "--zen-series-cpu",
  seriesMem: "--zen-series-mem",
  seriesDisk: "--zen-series-disk",
  seriesSwap: "--zen-series-swap",
  seriesNetIn: "--zen-series-net-in",
  seriesNetOut: "--zen-series-net-out",
  seriesTcp: "--zen-series-tcp",
  seriesUdp: "--zen-series-udp",
  seriesProc: "--zen-series-proc",
  latency1: "--zen-latency-1",
  latency2: "--zen-latency-2",
  latency3: "--zen-latency-3",
  latency4: "--zen-latency-4",
} as const;

export type DetailColorTokens = Record<keyof typeof DETAIL_CSS_VAR_KEYS, string>;

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

export const DEFAULT_PRESET_ID: ColorPresetId = "Kumo";

/** Supported palettes, including their light and dark detail roles. */
export const COLOR_PRESET_IDS: ColorPresetId[] = [
  "Kumo",
  "Anthropic",
  "Carbon",
  "Supabase",
];
