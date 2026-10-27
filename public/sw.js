// The app shell precache. This static export navigates like an MPA:
// every route change re-fetches the document and the build assets. This
// worker keeps the immutable, content-hashed assets and the small HTML
// documents in the browser, so navigations return instantly while the
// live queries (profile, geocoding) ride the network.
//
// Caching policy — never violated:
// - only same-origin GETs are considered
// - cross-origin requests (the api at its own origin, the geocoding
//   service) are untouched: profile and auth data are never cached
// - build assets (/_next/static/) are cache-first: they are
//   content-hashed, so a hit is always the right bytes
// - documents (request.mode === 'navigate') are network-first: the
//   fresh document wins, the cache is only the offline fallback
//
// A failed install or registration degrades to plain network
// navigation: this is an acceleration, never a dependency.

const VERSION = 'shell-v2026-10-27.1';
const SHELL_CACHE = `documents-${VERSION}`;
const IMMUTABLE_CACHE = `assets-${VERSION}`;
const SHELL_ROUTES = [
  '/',
  '/login/',
  '/logout/',
  '/register/',
  '/register/confirm/',
  '/app/',
  '/app/profile/',
  '/404.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_ROUTES);
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Retire the caches of retired versions; then take control of the
      // open tabs so the next navigation already rides the cache.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== IMMUTABLE_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Documents: network-first, cache as the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match(request, { ignoreSearch: true })) ??
            (await cache.match('/404.html')) ??
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Immutable build assets: cache-first forever.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMMUTABLE_CACHE);
        const hit = await cache.match(request);
        if (hit) {
          return hit;
        }
        const fresh = await fetch(request);
        cache.put(request, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }
  // Everything else (other same-origin GETs) passes through untouched.
});