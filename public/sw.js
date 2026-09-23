// RetailNext PWA Service Worker with Instant Auto-Update
const CACHE_NAME = "retailnext-cache-v2";

self.addEventListener("install", (event) => {
  // Immediately activate the new service worker without waiting
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete old outdated caches on activate
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      // Immediately take control of all open pages/clients
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Network-First strategy: Always fetch fresh code & data from the server
// Fall back to cache only when completely offline
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Don't intercept non-GET requests (e.g. POST to /api/orders)
  if (request.method !== "GET") return;

  // For HTML navigation requests, ALWAYS prioritize network to load newest code immediately
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // For static assets, try network first, then cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
