import { useLayoutEffect } from "react";
import {
  applyColorScheme,
  colorSchemeFromTheme,
  resolveColorScheme,
} from "@/lib/colorScheme";
import type { ColorPresetId, ColorSchemeOverrides } from "@/lib/colorScheme";
import type { ResolvedTheme } from "@/hooks/useThemePreference";
import { readThemeSettingsCache } from "@/lib/themeAppearance";

export function useColorScheme(
  theme: ResolvedTheme,
  presetId: ColorPresetId,
  overrides: ColorSchemeOverrides,
  hasPublicSettings = true,
): void {
  useLayoutEffect(() => {
    // A pending/failed public-info request must not freeze the previous mode's colors.
    const settings = hasPublicSettings
      ? { presetId, overrides }
      : colorSchemeFromTheme(readThemeSettingsCache() ?? {});
    applyColorScheme(
      resolveColorScheme({
        presetId: settings.presetId,
        mode: theme,
        overrides: settings.overrides,
      }),
    );
  }, [
    hasPublicSettings,
    theme,
    presetId,
    overrides.bgLight,
    overrides.bgDark,
    overrides.surfaceLight,
    overrides.surfaceDark,
    overrides.accentLight,
    overrides.accentDark,
  ]);
}
