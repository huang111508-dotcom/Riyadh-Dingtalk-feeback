// A minimal Service Worker to allow "Add to Home Screen"
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple pass-through strategy
  event.respondWith(fetch(event.request));
});