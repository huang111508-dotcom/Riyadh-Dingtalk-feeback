
const CACHE_NAME = 'dingtalk-parser-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
  // Note: If you have a logo.png, the browser will cache it automatically when fetched by the manifest
];

// Install event - Cache core assets
self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We wrap this in a try-catch or handle individual failures 
      // so one missing file doesn't break the whole install
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.error('Failed to cache core assets:', err);
      });
    })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch event - Cache First, fall back to Network
self.addEventListener('fetch', (event) => {
  // Only handle http/https requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if found
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request).then((response) => {
        // Don't cache valid non-200 responses (e.g. 404s) or basic requests
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone response to cache it
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Optional: Return a custom offline page here if network fails
        // return caches.match('/offline.html');
      });
    })
  );
});
