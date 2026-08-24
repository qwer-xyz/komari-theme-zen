import { useEffect, useState } from "react";
import {
  detectSystemTheme,
  readThemePreference,
  syncDocumentThemeClass,
  writeThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/themePreferenceStorage";

export type { ResolvedTheme, ThemePreference };

export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = readThemePreference();
    syncDocumentThemeClass(stored);
    return stored;
  });
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(detectSystemTheme);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    writeThemePreference(next);
    syncDocumentThemeClass(next);
  };

  const theme: ResolvedTheme =
    preference === "auto" ? systemTheme : preference;

  useEffect(() => {
    syncDocumentThemeClass(preference);
  }, [preference, systemTheme]);

  return { preference, theme, setPreference };
}
