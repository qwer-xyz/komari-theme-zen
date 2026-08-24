import {
  applyColorScheme,
  colorSchemeFromTheme,
  resolveColorScheme,
} from "@/lib/colorScheme";
import {
  applyFontScheme,
  fontSchemeFromTheme,
  resolveFontScheme,
} from "@/lib/fontScheme";
import { DEFAULT_FONT_PRESET_ID } from "@/lib/fontScheme/tokens";
import {
  resolveThemePreference,
  syncDocumentThemeClass,
  type ResolvedTheme,
} from "@/lib/themePreferenceStorage";

const CACHE_KEY = "komari-zen-theme-settings";

export function readThemeSettingsCache(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function writeThemeSettingsCache(raw: Record<string, unknown>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
  } catch {
    /* ignore */
  }
}

export function applyAppearanceFromThemeSettings(
  raw: Record<string, unknown>,
  mode: ResolvedTheme = resolveThemePreference(),
): void {
  const colorScheme = colorSchemeFromTheme(raw);
  const fontScheme = fontSchemeFromTheme(raw);

  applyColorScheme(
    resolveColorScheme({
      presetId: colorScheme.presetId,
      mode,
      overrides: colorScheme.overrides,
    }),
  );
  applyFontScheme(resolveFontScheme(fontScheme));
}

/** Sync light/dark class + cached admin colors/fonts before React paints. */
export function bootstrapThemeAppearance(): ResolvedTheme {
  const mode = syncDocumentThemeClass();
  const cached = readThemeSettingsCache();

  if (cached) {
    applyAppearanceFromThemeSettings(cached, mode);
    return mode;
  }

  applyFontScheme(
    resolveFontScheme({
      presetId: DEFAULT_FONT_PRESET_ID,
      customFamily: "",
      customCssUrl: "",
    }),
  );
  return mode;
}

export function syncThemeAppearanceFromPublicSettings(
  raw: Record<string, unknown> | null | undefined,
): void {
  if (!raw) return;
  writeThemeSettingsCache(raw);
  applyAppearanceFromThemeSettings(raw, resolveThemePreference());
}
