// ══════════════════════════════════════════
//  FamilyHub — Service Worker v4
//  Toutes les sous-applications couvertes
// ══════════════════════════════════════════

const VERSION      = '4';
const CACHE_STATIC = 'fh-static-v' + VERSION;
const CACHE_DYN    = 'fh-dyn-v'    + VERSION;

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

// ── Install : mettre en cache tous les assets statiques ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(new Request(url, { cache: 'reload' }))
            .catch(e => console.warn('SW: impossible de cacher', url, e))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate : supprimer les anciens caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYN)
          .map(k => {
            console.log('SW: suppression cache obsolète', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie hybride ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes externes (Firebase, Fonts, CDN)
  if (url.origin !== self.location.origin) return;

  // Navigation HTML : Network First → fallback cache → fallback racine
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE_STATIC).then(c => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match(request)
            .then(r => r || caches.match('/index.html'))
        )
    );
    return;
  }

  // Assets statiques (JS, CSS, images, fonts) : Cache First
  const ext = url.pathname.split('.').pop().toLowerCase();
  if (['js','css','png','svg','ico','woff','woff2','jpg','jpeg'].includes(ext)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            caches.open(CACHE_DYN).then(c => c.put(request, res.clone()));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Tout le reste : Network First avec fallback cache
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          caches.open(CACHE_DYN).then(c => c.put(request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
