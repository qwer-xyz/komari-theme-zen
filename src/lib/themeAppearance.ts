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
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const APPEARANCE_KEYS = [
  "colorPreset",
  "customBgLight",
  "customBgDark",
  "customSurfaceLight",
  "customSurfaceDark",
  "customAccentLight",
  "customAccentDark",
  "fontPreset",
  "fontFamilyCustom",
  "fontCssUrlCustom",
] as const;

type ThemeSettingsCache = {
  version: number;
  fetchedAt: number;
  settings: Record<string, unknown>;
};

function appearanceSettings(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    APPEARANCE_KEYS.filter((key) => key in raw).map((key) => [key, raw[key]]),
  );
}

function clearThemeSettingsCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function readThemeSettingsCache(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const cache = parsed as Partial<ThemeSettingsCache>;
    if (
      cache.version === CACHE_VERSION &&
      typeof cache.fetchedAt === "number" &&
      cache.settings &&
      typeof cache.settings === "object"
    ) {
      if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
        clearThemeSettingsCache();
        return null;
      }
      return cache.settings;
    }

    // Read and immediately migrate the previous unversioned shape so it also
    // gains the bounded lifetime on subsequent starts.
    const migrated = appearanceSettings(parsed as Record<string, unknown>);
    writeThemeSettingsCache(migrated);
    return migrated;
  } catch {
    return null;
  }
}

export function writeThemeSettingsCache(raw: Record<string, unknown>): void {
  try {
    const cache: ThemeSettingsCache = {
      version: CACHE_VERSION,
      fetchedAt: Date.now(),
      settings: appearanceSettings(raw),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
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
  if (!raw) {
    clearThemeSettingsCache();
    applyAppearanceFromThemeSettings({}, resolveThemePreference());
    return;
  }
  const settings = appearanceSettings(raw);
  writeThemeSettingsCache(settings);
  applyAppearanceFromThemeSettings(settings, resolveThemePreference());
}
