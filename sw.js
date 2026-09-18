const CACHE_NAME = 'ronda-rt01-v3.0.2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './operations.js',
  './app.css',
  './app-config.js',
  './vendor/tailwind.css',
  './vendor/supabase.js',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './favicon.ico'
];

// Install: Cache core offline shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for local assets, Network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // Skip non-GET requests or Supabase/API requests
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse || new Response('Aplikasi sedang offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      }));

      return cachedResponse || fetchPromise;
    })
  );
});
