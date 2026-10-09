/*
 * Komari Zen owns the service worker slot for this origin.
 *
 * The bundled default frontend registers a root-scoped PWA worker that
 * precaches its own index.html and answers navigations from that cache. Because
 * the backend falls back to the bundled default theme for any file a theme does
 * not ship, a theme without its own sw.js inherits that worker and visitors get
 * the default theme's page instead of this one.
 *
 * This worker deliberately has no fetch handler: every request goes to the
 * server, which picks the right page for the active theme, /admin, /terminal
 * and plugin routes. It cleans up the stale precache, then unregisters itself
 * so nothing keeps a claim on the origin.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const scope = self.registration.scope;
        const names = await caches.keys();
        await Promise.all(
          names
            .filter(
              (name) =>
                name.startsWith("workbox-precache") && name.endsWith(scope),
            )
            .map((name) => caches.delete(name)),
        );
      } catch (error) {
        console.warn("Komari Zen: could not clear the legacy PWA cache", error);
      }
      await self.clients.claim();
      await self.registration.unregister();
    })(),
  );
});
