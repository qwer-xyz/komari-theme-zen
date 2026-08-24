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

  const vars = modeTokensToVars(modeTokens);

  vars[CSS_VAR_KEYS.chartCpu] = preset.charts.chartCpu;
  vars[CSS_VAR_KEYS.chartMem] = preset.charts.chartMem;
  vars[CSS_VAR_KEYS.chartSwap] = preset.charts.chartSwap;
  vars[CSS_VAR_KEYS.chartLoad] = preset.charts.chartLoad;
  vars[CSS_VAR_KEYS.chartNetIn] = preset.charts.chartNetIn;
  vars[CSS_VAR_KEYS.chartNetOut] = preset.charts.chartNetOut;
  vars[CSS_VAR_KEYS.chartTcp] = preset.charts.chartTcp;
  vars[CSS_VAR_KEYS.chartUdp] = preset.charts.chartUdp;

  return vars;
}
