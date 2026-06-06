// ══════════════════════════════════════════
//  FamilyHub — Service Worker v5 OPTIMIZED
// ══════════════════════════════════════════

const VERSION      = '6';
const CACHE_STATIC = 'fh-static-v' + VERSION;
const CACHE_DYN    = 'fh-dyn-v'    + VERSION;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/firebaseSync.js',
  '/firebaseSync.test.js',
  '/capacitor.config.json',
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
  '/icons/home-192.png',
  '/icons/home-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => {
          return cache.add(new Request(url, { cache: 'reload' }))
            .catch(e => console.warn('SW: ❌ Cache fail:', url, e.message));
        })
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_STATIC && k !== CACHE_DYN).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_STATIC).then(cache => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => {
          return caches.match(request).then(r => {
            if (r) return r;
            const segments = url.pathname.split('/');
            const subApp = segments[1];
            const subAppIndex = `/${subApp}/index.html`;
            return STATIC_ASSETS.includes(subAppIndex) 
              ? caches.match(subAppIndex) 
              : caches.match('/index.html');
          });
        })
    );
    return;
  }

  const ext = url.pathname.split('.').pop().toLowerCase();
  const staticExts = ['js', 'css', 'png', 'svg', 'ico', 'woff', 'woff2', 'jpg', 'jpeg', 'gif', 'webp'];
  
  if (staticExts.includes(ext)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_DYN).then(cache => cache.put(request, clone));
          }
          return res;
        }).catch(() => new Response('Offline Asset Unavailable', { status: 503 }));
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then(res => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_DYN).then(cache => cache.put(request, clone));
      }
      return res;
    }).catch(() => caches.match(request).then(cached => cached || new Response('Offline', { status: 503 })))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
