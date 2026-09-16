// Someone Service Worker
// Offline app shell reliability with Network-First navigation & aggressive asset caching

const CACHE_NAME = 'someone-shell-v2';

// Core app shell assets cached on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/apple-touch-icon.png',
  '/brand-artwork.png',
  '/src/main.tsx',
  '/src/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 1. Precache known shell assets safely (Promise.allSettled prevents one 404 from aborting install)
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (asset) => {
          try {
            const res = await fetch(asset, { cache: 'no-cache' });
            if (res && (res.ok || res.type === 'opaque')) {
              await cache.put(asset, res);
            }
          } catch (err) {
            console.warn(`[SW] Precache skipped for ${asset}:`, err.message);
          }
        })
      );

      // 2. Fetch /index.html and dynamically precache referenced client bundles, root CSS, and icons
      try {
        const indexRes = await fetch('/index.html', { cache: 'no-cache' });
        if (indexRes && indexRes.ok) {
          await cache.put('/index.html', indexRes.clone());
          await cache.put('/', indexRes.clone());
          const html = await indexRes.text();

          // Extract script sources (<script ... src="...">)
          const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
          // Extract stylesheet links (<link ... rel="stylesheet" ... href="...">)
          const css1 = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]);
          const css2 = [...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi)].map((m) => m[1]);
          // Extract icons
          const icons = [...html.matchAll(/<link[^>]+rel=["'](?:shortcut\s+)?icon["'][^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]);

          const dynamicAssets = [...new Set([...scripts, ...css1, ...css2, ...icons])];

          await Promise.allSettled(
            dynamicAssets
              .filter((url) => !url.startsWith('http') || url.startsWith(self.location.origin))
              .map(async (url) => {
                try {
                  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
                  const res = await fetch(cleanUrl, { cache: 'no-cache' });
                  if (res && (res.ok || res.type === 'opaque')) {
                    await cache.put(cleanUrl, res);
                  }
                } catch (e) {
                  // Ignore non-critical runtime bundle precache warnings
                }
              })
          );
        }
      } catch (err) {
        console.warn('[SW] Could not inspect index.html dynamically on install:', err);
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // CRITICAL: Explicitly bypass all dynamic API routes and WebSocket connections
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/ws') ||
    url.pathname.includes('/socket') ||
    request.method !== 'GET' ||
    !url.protocol.startsWith('http')
  ) {
    return;
  }

  // 1. Navigation requests: "Network First, falling back to Cache"
  // Ensures fresh code when connected, but falls back reliably to cached app shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              cache.put('/index.html', networkResponse.clone());
              cache.put('/', networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[SW] Navigation offline: falling back to cached app shell');
          const cache = await caches.open(CACHE_NAME);
          const cachedNav = await cache.match(request);
          if (cachedNav) return cachedNav;
          const cachedIndex = await cache.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const cachedRoot = await cache.match('/');
          if (cachedRoot) return cachedRoot;
          
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body style="font-family:sans-serif;text-align:center;padding:48px;color:#2D2723;background:#F6F3EE;"><h2>Waiting for network signal...</h2><p>Please reconnect to the internet to resume conversations.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 2. Google Fonts & Web Fonts: Cache First with network fallback
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // 3. Static assets (client bundles, root CSS, icons, images, manifest):
  // Stale-While-Revalidate / Cache First with network revalidation
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => null);

      // If cached copy exists, return it immediately for instant offline shell reliability
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache, wait for network fetch
      return fetchPromise.then((networkResponse) => {
        if (networkResponse) return networkResponse;
        return new Response('Asset unavailable offline', { status: 404 });
      });
    })
  );
});
