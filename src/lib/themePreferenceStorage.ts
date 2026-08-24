export type ThemePreference = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "komari-zen-theme";

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "auto") {
      return value;
    }
  } catch {
    /* ignore */
  }
  return "auto";
}

export function writeThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* ignore */
  }
}

export function detectSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveThemePreference(
  preference: ThemePreference = readThemePreference(),
): ResolvedTheme {
  return preference === "auto" ? detectSystemTheme() : preference;
}

/** Apply `.dark` on <html> before first paint to avoid light/dark flash. */
export function syncDocumentThemeClass(
  preference: ThemePreference = readThemePreference(),
): ResolvedTheme {
  const resolved = resolveThemePreference(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  return resolved;
}
