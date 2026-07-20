// public/sw.js
// SPARK service worker — exists ONLY to make the app installable and to
// provide a graceful offline fallback. This is deliberately NOT a
// cache-first / precaching service worker.
//
// WHY: earlier this week, a stale bundle served from cache caused a
// hard-to-diagnose black-screen bug. A service worker that aggressively
// caches the JS bundle would risk reintroducing that exact class of bug
// on every future deploy. So this SW always prefers the network, and
// only falls back to a cached copy if the network genuinely fails
// (i.e. the user is actually offline).
//
// Bump CACHE_VERSION whenever this file changes so old caches get purged
// on the next activate.
const CACHE_VERSION = "spark-sw-v1";
const OFFLINE_FALLBACK_CACHE = `${CACHE_VERSION}-offline`;

self.addEventListener("install", (event) => {
  // Activate this SW immediately, don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Purge any caches from previous SW versions
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== OFFLINE_FALLBACK_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests; let everything else pass through untouched
  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        // Always try the network first — this guarantees fresh deploys
        // are visible immediately, with no stale-bundle risk.
        const networkResponse = await fetch(request);

        // Opportunistically cache a small offline fallback copy of the
        // shell (index.html) only — never the hashed JS/CSS bundles.
        if (request.mode === "navigate" && networkResponse.ok) {
          const cache = await caches.open(OFFLINE_FALLBACK_CACHE);
          cache.put(request, networkResponse.clone());
        }

        return networkResponse;
      } catch (err) {
        // Network failed — genuinely offline. Fall back to the last
        // cached shell for navigations; otherwise just fail normally.
        if (request.mode === "navigate") {
          const cache = await caches.open(OFFLINE_FALLBACK_CACHE);
          const cached = await cache.match(request);
          if (cached) return cached;
        }
        throw err;
      }
    })()
  );
});
