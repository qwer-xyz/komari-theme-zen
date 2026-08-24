/**
 * @license
 * SPDX-License-Identifier: MIT
 */

/**
 * Lightweight HTML sanitizer for the admin-configured footer snippet.
 * It is not a full XSS engine, but it strips the common active vectors:
 * <script>/<style>/<iframe> etc. elements, `on*` event handlers, and
 * `javascript:` URLs. The footer value is admin-controlled, so this is
 * defence-in-depth rather than untrusted-input handling.
 */
const DANGEROUS_TAGS =
  /<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|svg|math)\b[^>]*>/gi;
const EVENT_HANDLERS = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URI = /(href|src|xlink:href)\s*=\s*("|')?\s*javascript:[^"'>\s]*/gi;

export function sanitizeFooterHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(DANGEROUS_TAGS, "")
    .replace(EVENT_HANDLERS, "")
    .replace(JS_URI, "");
}
