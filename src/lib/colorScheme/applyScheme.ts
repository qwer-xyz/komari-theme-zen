import { DETAIL_CSS_VAR_KEYS, type ResolvedColorVars } from "./tokens";

export function applyColorScheme(vars: ResolvedColorVars): void {
  const root = document.documentElement;
  // Clear omitted roles if a partial map is applied, rather than retaining stale colors.
  for (const key of Object.values(DETAIL_CSS_VAR_KEYS)) {
    if (!Object.hasOwn(vars, key)) root.style.removeProperty(key);
  }
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
