// Babol Pakhsh Service Worker - Database-First & Fast Deploy
const CACHE_VERSION = 'farhoodi-b2b-v14-assets-cache-first-__BUILD_TIMESTAMP__';
const CACHE_NAME = `babolpakhsh-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192-v2.png',
  './icon-512-v2.png',
  './apple-touch-icon-v2.png',
  './favicon-v2.png',
  './fonts/Vazirmatn-Variable.woff2',
  './fonts/Vazirmatn-Regular.woff2',
  './fonts/Vazirmatn-Bold.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // CRITICAL: Never intercept or cache Supabase database, realtime, or auth requests (direct or custom)
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/rest/v1') ||
    url.pathname.includes('/auth/v1') ||
    url.pathname.includes('/realtime/v1') ||
    url.pathname.includes('/functions/v1') ||
    url.pathname.includes('/storage/v1/object/sign') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // Never cache sw.js itself
  if (url.pathname.endsWith('/sw.js')) {
    return;
  }

  // 1. Hashed build assets (/assets/*.js, /assets/*.mjs, /assets/*.css):
  //    Cache-First (filenames include content hashes, so cached responses are always immutable and safe).
  //    CRITICAL: NEVER fallback to index.html for code/style chunks.
  const isHashedBuildAsset =
    /\/assets\/.+\.(js|mjs|css)$/i.test(url.pathname);

  if (isHashedBuildAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // 2. Any other non-hashed script/style outside /assets/: Network-First with exact cache fallback ONLY.
  const isOtherScriptOrStyle =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.mjs') ||
    url.pathname.endsWith('.css');

  if (isOtherScriptOrStyle) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) {
            return cached;
          }
          return Response.error();
        })
    );
    return;
  }

  // 2. Navigation requests: Network-First with fallback to index.html ONLY for navigation mode
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallbackIndex = (await caches.match('./index.html')) || (await caches.match('/'));
          if (fallbackIndex) return fallbackIndex;
          return Response.error();
        })
    );
    return;
  }

  // 3. Cache-First with network fallback for fonts, static icons, and images
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    })
  );
});
