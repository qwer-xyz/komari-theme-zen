/*
 * Intentionally does nothing.
 *
 * /admin and /terminal are rendered from the bundled default frontend, whose
 * HTML still loads /registerSW.js. Serving this file from the theme's dist
 * shadows the default registration script, so the root-scoped PWA worker is
 * never registered while this theme is active. The theme's own public/sw.js
 * dismisses an already-installed one.
 */
