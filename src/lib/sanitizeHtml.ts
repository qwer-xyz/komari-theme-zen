/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const ALLOWED_TAGS = new Set([
  "A",
  "B",
  "BR",
  "CODE",
  "DIV",
  "EM",
  "I",
  "P",
  "SMALL",
  "SPAN",
  "STRONG",
  "U",
]);
const DROP_WITH_CONTENT = new Set([
  "BASE",
  "EMBED",
  "FORM",
  "IFRAME",
  "LINK",
  "MATH",
  "META",
  "OBJECT",
  "SCRIPT",
  "STYLE",
  "SVG",
]);
const GLOBAL_ATTRIBUTES = new Set(["class", "title", "aria-label"]);

export function safeLinkHref(
  raw: string,
  baseHref = typeof window !== "undefined"
    ? window.location.href
    : "http://localhost/",
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return trimmed;
  try {
    const url = new URL(trimmed, baseHref);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
      ? trimmed
      : null;
  } catch {
    return null;
  }
}

/** Sanitize the small admin-configured footer fragment using a strict allowlist. */
export function sanitizeFooterHtml(html: string): string {
  if (!html || typeof DOMParser === "undefined") return "";
  const document = new DOMParser().parseFromString(html, "text/html");
  const elements = [...document.body.querySelectorAll("*")];

  for (const element of elements) {
    if (DROP_WITH_CONTENT.has(element.tagName)) {
      element.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      continue;
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const allowAnchorAttribute =
        element.tagName === "A" && ["href", "target", "rel"].includes(name);
      if (!GLOBAL_ATTRIBUTES.has(name) && !allowAnchorAttribute) {
        element.removeAttribute(attribute.name);
      }
    }

    if (element instanceof HTMLAnchorElement) {
      const href = safeLinkHref(element.getAttribute("href") ?? "");
      if (href) element.setAttribute("href", href);
      else element.removeAttribute("href");
      if (element.target !== "_blank" && element.target !== "_self") {
        element.removeAttribute("target");
      }
      if (element.target === "_blank") {
        element.rel = "noopener noreferrer";
      } else {
        element.removeAttribute("rel");
      }
    }
  }

  return document.body.innerHTML;
}
