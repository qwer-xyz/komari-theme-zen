import { parseOptionalHex } from "./parseColor";
import { normalizePresetId } from "./resolveScheme";
import type { ColorPresetId, ColorSchemeOverrides } from "./tokens";
import { DEFAULT_PRESET_ID } from "./tokens";
import { parseThemeSelectOption } from "@/lib/themeOptionValue";

export type ColorSchemeSettings = {
  presetId: ColorPresetId;
  overrides: ColorSchemeOverrides;
};

export function colorSchemeFromTheme(
  raw: Record<string, unknown>,
): ColorSchemeSettings {
  const previewPreset = import.meta.env.DEV && import.meta.env.VITE_COLOR_PRESET;
  if (previewPreset) {
    return { presetId: normalizePresetId(previewPreset), overrides: {} };
  }
  const presetRaw = parseThemeSelectOption(raw.colorPreset, DEFAULT_PRESET_ID);
  return {
    presetId: normalizePresetId(presetRaw),
    overrides: {
      bgLight: parseOptionalHex(raw.customBgLight),
      bgDark: parseOptionalHex(raw.customBgDark),
      surfaceLight: parseOptionalHex(raw.customSurfaceLight),
      surfaceDark: parseOptionalHex(raw.customSurfaceDark),
      accentLight: parseOptionalHex(raw.customAccentLight),
      accentDark: parseOptionalHex(raw.customAccentDark),
    },
  };
}
