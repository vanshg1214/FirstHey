const CACHE_NAME = 'firsthey-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests to network
  // A fetch listener is required by Chrome to trigger the PWA install prompt
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response("Offline mode not supported yet.", {
        status: 503,
        statusText: "Service Unavailable"
      });
    })
  );
});
