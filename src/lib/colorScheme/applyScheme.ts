import type { ResolvedColorVars } from "./tokens";

export function applyColorScheme(vars: ResolvedColorVars): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
