import { useLayoutEffect } from "react";
import { applyFontScheme, resolveFontScheme } from "@/lib/fontScheme";
import type { FontSchemeSettings } from "@/lib/fontScheme";

export function useThemeFont(fontScheme: FontSchemeSettings): void {
  useLayoutEffect(() => {
    applyFontScheme(resolveFontScheme(fontScheme));
  }, [
    fontScheme.presetId,
    fontScheme.customFamily,
    fontScheme.customCssUrl,
  ]);
}
