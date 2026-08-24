import type { ResolvedFontScheme } from "./resolveFont";
import { FONT_CSS_VAR_KEYS } from "./tokens";

const FONT_LINK_ATTR = "data-zen-font";

function removeFontAssets(): void {
  document
    .querySelectorAll(`link[${FONT_LINK_ATTR}]`)
    .forEach((node) => node.remove());
}

function ensurePreconnect(hrefs: string[]): void {
  for (const href of hrefs) {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
      continue;
    }
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (href.includes("gstatic") || href.includes("zeoseven")) {
      link.crossOrigin = "";
    }
    link.setAttribute(FONT_LINK_ATTR, "preconnect");
    document.head.appendChild(link);
  }
}

function ensureStylesheets(urls: string[]): void {
  for (const href of urls) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute(FONT_LINK_ATTR, "stylesheet");
    document.head.appendChild(link);
  }
}

export function applyFontScheme(scheme: ResolvedFontScheme): void {
  const root = document.documentElement;

  removeFontAssets();
  ensurePreconnect(scheme.preconnect);
  ensureStylesheets(scheme.cssUrls);

  root.style.setProperty(FONT_CSS_VAR_KEYS.sans, scheme["--font-sans"]);
  root.style.setProperty(FONT_CSS_VAR_KEYS.mono, scheme["--font-mono"]);
}
