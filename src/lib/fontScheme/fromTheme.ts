import { parseThemeSelectOption } from "@/lib/themeOptionValue";
import { normalizeFontPresetId } from "./resolveFont";
import type { FontSchemeSettings } from "./tokens";
import { DEFAULT_FONT_PRESET_ID } from "./tokens";

export function fontSchemeFromTheme(
  raw: Record<string, unknown>,
): FontSchemeSettings {
  const presetRaw = parseThemeSelectOption(raw.fontPreset, "Default");
  return {
    presetId: normalizeFontPresetId(presetRaw),
    customFamily: typeof raw.fontFamilyCustom === "string"
      ? raw.fontFamilyCustom
      : "",
    customCssUrl: typeof raw.fontCssUrlCustom === "string"
      ? raw.fontCssUrlCustom
      : "",
  };
}

export { DEFAULT_FONT_PRESET_ID };
