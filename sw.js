// ══════════════════════════════════════════
//  FamilyHub — Service Worker
//  Couvre toutes les sous-applications
//  Stratégie : Cache First (assets) + Network First (données)
// ══════════════════════════════════════════

const VERSION     = '3';
const CACHE_STATIC = 'familyhub-static-v' + VERSION;
const CACHE_DYNAMIC= 'familyhub-dynamic-v' + VERSION;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/sw.js',
  '/manifest.json',
  '/locker-tracker/index.html',
  '/locker-tracker/manifest.json',
  '/todo-partage/index.html',
  '/todo-partage/manifest.json',
  '/cave-spiritueux/index.html',
  '/cave-spiritueux/manifest.json',
  '/menus-semaine/index.html',
  '/menus-semaine/manifest.json',
  '/liste-courses/index.html',
  '/liste-courses/manifest.json',
];

// ── Install ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).then(() => self.skipWaiting())
  );
});

// ── Activate : nettoyer les anciens caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch ──
self.addEventListener('fetch', event => {
  const request = event.request;
  const url     = new URL(request.url);

  // Ne pas intercepter les requêtes externes (Firebase, Google Fonts, etc.)
  if (url.origin !== self.location.origin) return;

  // Navigation (HTML) : Network First avec fallback cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(c => c.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Assets statiques (CSS, JS, images, fonts) : Cache First
  if (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')  ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.includes('fonts.googleapis') ||
    url.pathname.includes('fonts.gstatic')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_DYNAMIC).then(c => c.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Tout le reste : Network First avec cache dynamique
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_DYNAMIC).then(c => c.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
