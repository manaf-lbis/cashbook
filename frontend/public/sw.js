const CACHE_NAME = 'cashbook-pwa-v3';

// Install Event: activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate Event: purge ALL legacy caches from previous deployments
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          console.log('[SW] Purging cache:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: pass-through to native browser network (never blocks or interferes with dynamic assets)
self.addEventListener('fetch', () => {
  return;
});
