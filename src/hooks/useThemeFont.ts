import { useLayoutEffect } from "react";
import { applyFontScheme, resolveFontScheme } from "@/lib/fontScheme";
import type { FontSchemeSettings } from "@/lib/fontScheme";

export function useThemeFont(
  fontScheme: FontSchemeSettings,
  enabled = true,
): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    applyFontScheme(resolveFontScheme(fontScheme));
  }, [
    enabled,
    fontScheme.presetId,
    fontScheme.customFamily,
    fontScheme.customCssUrl,
  ]);
}
