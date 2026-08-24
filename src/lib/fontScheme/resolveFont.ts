import { FONT_PRESETS } from "./presets";
import type {
  FontPresetId,
  FontSchemeSettings,
  ResolvedFontVars,
} from "./tokens";
import { DEFAULT_FONT_PRESET_ID, FONT_CSS_VAR_KEYS } from "./tokens";

export type ResolvedFontScheme = ResolvedFontVars & {
  cssUrls: string[];
  preconnect: string[];
};

const FALLBACK_SANS = FONT_PRESETS.Default.sans;
const FALLBACK_MONO = FONT_PRESETS.Default.mono;

export function normalizeFontPresetId(raw: string): FontPresetId {
  if (raw in FONT_PRESETS) return raw as FontPresetId;
  return DEFAULT_FONT_PRESET_ID;
}

export function resolveFontScheme(
  settings: FontSchemeSettings,
): ResolvedFontScheme {
  const presetId = normalizeFontPresetId(settings.presetId);

  if (presetId === "Custom") {
    const family = settings.customFamily.trim();
    const cssUrl = settings.customCssUrl.trim();
    const quotedFamily = family ? `"${family.replace(/"/g, '\\"')}"` : "";
    const stack = quotedFamily
      ? `${quotedFamily}, ui-sans-serif, system-ui, sans-serif`
      : FALLBACK_SANS;
    const monoStack = quotedFamily
      ? `${quotedFamily}, ui-monospace, monospace`
      : FALLBACK_MONO;

    return {
      [FONT_CSS_VAR_KEYS.sans]: stack,
      [FONT_CSS_VAR_KEYS.mono]: monoStack,
      cssUrls: cssUrl ? [cssUrl] : FONT_PRESETS.Default.cssUrls.slice(),
      preconnect: cssUrl ? [] : (FONT_PRESETS.Default.preconnect?.slice() ?? []),
    };
  }

  const preset = FONT_PRESETS[presetId];
  return {
    [FONT_CSS_VAR_KEYS.sans]: preset.sans,
    [FONT_CSS_VAR_KEYS.mono]: preset.mono,
    cssUrls: preset.cssUrls.slice(),
    preconnect: preset.preconnect?.slice() ?? [],
  };
}
