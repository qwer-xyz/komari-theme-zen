import { parseOptionalHex } from "./parseColor";
import { normalizePresetId } from "./resolveScheme";
import type { ColorPresetId, ColorSchemeOverrides } from "./tokens";
import { parseThemeSelectOption } from "@/lib/themeOptionValue";

export type ColorSchemeSettings = {
  presetId: ColorPresetId;
  overrides: ColorSchemeOverrides;
};

export function colorSchemeFromTheme(
  raw: Record<string, unknown>,
): ColorSchemeSettings {
  const presetRaw = parseThemeSelectOption(raw.colorPreset, "Warm");
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
