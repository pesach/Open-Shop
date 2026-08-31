/**
 * Open-Shop Offline Service Worker (sw.js)
 * Enables 100% offline usage with robust caching of core engine files,
 * styles, fonts, vector icons, and diagnostic tools.
 */
const CACHE_NAME = 'openshop-cache-v5';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style/all.css',
  './style/fonts/opensans-400.ttf',
  './style/fonts/opensans-400i.ttf',
  './style/fonts/opensans-700.ttf',
  './style/fonts/opensans-700i.ttf',
  './code/openshop.js',
  './code/dbs.js',
  './code/external/ext.js',
  './code/openshop-logger.js',
  './code/openshop-recovery.js',
  './code/openshop-agent.js',
  './code/openshop-memory.js',
  './code/openshop-batch.js',
  './code/openshop-color.js',
  './code/openshop-vector.js',
  './code/openshop-format.js',
  './code/openshop-ps-compat.js',
  './promo/icon.svg',
  './promo/logo.svg',
  './promo/icon256.png',
  './promo/icon512.png',
  './demo.psd'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Open-Shop SW] Pre-caching core assets for offline operation');
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[Open-Shop SW] Some assets could not be pre-cached:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Open-Shop SW] Removing outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only intercept GET requests
  if (request.method !== 'GET') return;

  // Cache-first strategy for local assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
