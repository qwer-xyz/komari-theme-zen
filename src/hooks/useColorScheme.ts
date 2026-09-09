import { useLayoutEffect } from "react";
import { applyColorScheme, resolveColorScheme } from "@/lib/colorScheme";
import type { ColorPresetId, ColorSchemeOverrides } from "@/lib/colorScheme";
import type { ResolvedTheme } from "@/hooks/useThemePreference";

export function useColorScheme(
  theme: ResolvedTheme,
  presetId: ColorPresetId,
  overrides: ColorSchemeOverrides,
  enabled = true,
): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    applyColorScheme(
      resolveColorScheme({
        presetId,
        mode: theme,
        overrides,
      }),
    );
  }, [
    enabled,
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
