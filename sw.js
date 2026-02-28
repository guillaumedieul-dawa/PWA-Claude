const CACHE_NAME = 'familyhub-v2.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './liste-courses/index.html',
  './locker-tracker/index.html',
  './todo-partage/index.html',
  './cave-spiritueux/index.html',
  './menus-semaine/index.html',
  './icons/home-192.png',
  './icons/home-512.png',
  './icons/courses-192.png',
  './icons/courses-512.png',
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: Network first for navigation, Cache first for assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET or external (Google Fonts ok to cache)
  if (request.method !== 'GET') return;
  if (url.origin !== location.origin && !url.hostname.includes('fonts.googleapis.com') && !url.hostname.includes('fonts.gstatic.com')) return;

  // Navigation: network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => { const c = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, c)); return res; })
        .catch(() => caches.match(request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const c = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, c));
          }
          return res;
        });
      })
  );
});

// Background sync for shared data (future)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    // Future: sync with remote backend
    console.log('[SW] Background sync triggered');
  }
});
