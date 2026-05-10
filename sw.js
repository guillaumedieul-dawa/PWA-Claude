// ══════════════════════════════════════════
//  FamilyHub — Service Worker v4 FINAL
//  Toutes les sous-applications couvertes
//  Phase 3 - CORRIGÉ 10/05/2026
// ══════════════════════════════════════════

const VERSION      = '4';
const CACHE_STATIC = 'fh-static-v' + VERSION;
const CACHE_DYN    = 'fh-dyn-v'    + VERSION;

const STATIC_ASSETS = [
  // Root
  '/',
  '/index.html',
  '/sw.js',
  '/manifest.json',
  '/firebaseSync.js',           // ✅ CRITICAL - doit être en racine
  '/firebaseSync.test.js',      // Tests unitaires
  '/capacitor.config.json',
  
  // Sub-apps
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
  
  // Icons - IMPORTANT pour PWA
  '/icons/home-192.png',
  '/icons/home-512.png'
];

// ── Install : mettre en cache tous les assets statiques ──
self.addEventListener('install', event => {
  console.log('SW: Install event - caching assets');
  
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      // Utiliser allSettled pour ne pas bloquer si un asset échoue
      return Promise.allSettled(
        STATIC_ASSETS.map(url => {
          console.log('SW: Tentative cache de', url);
          return cache.add(new Request(url, { cache: 'reload' }))
            .then(() => console.log('SW: ✅ Cachée:', url))
            .catch(e => console.warn('SW: ❌ Impossible de cacher', url, e.message));
        })
      );
    }).then(() => {
      console.log('SW: Installation complète');
      self.skipWaiting();
    })
  );
});

// ── Activate : supprimer les anciens caches ──
self.addEventListener('activate', event => {
  console.log('SW: Activate event');
  
  event.waitUntil(
    caches.keys().then(keys => {
      console.log('SW: Caches trouvés:', keys);
      
      return Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYN)
          .map(k => {
            console.log('SW: Suppression cache obsolète:', k);
            return caches.delete(k);
          })
      );
    }).then(() => {
      console.log('SW: Activation complète');
      self.clients.claim();
    })
  );
});

// ── Fetch : stratégie hybride ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignorer les requêtes externes (Firebase, Fonts, CDN, etc.)
  if (url.origin !== self.location.origin) {
    // Laisser passer les requêtes Firebase, Google, etc.
    return;
  }

  // 2. Navigation HTML : Network First → fallback cache → fallback racine
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          // Mettre à jour le cache si la réponse est valide
          if (res && res.status === 200) {
            caches.open(CACHE_STATIC).then(cache => {
              cache.put(request, res.clone());
            });
          }
          return res;
        })
        .catch(() => {
          // En offline : retourner la page en cache ou index.html
          return caches.match(request)
            .then(r => r || caches.match('/index.html'))
            .catch(() => caches.match('/index.html'));
        })
    );
    return;
  }

  // 3. Assets statiques (JS, CSS, images, fonts) : Cache First
  const ext = url.pathname.split('.').pop().toLowerCase();
  const staticExts = ['js', 'css', 'png', 'svg', 'ico', 'woff', 'woff2', 'jpg', 'jpeg', 'gif', 'webp'];
  
  if (staticExts.includes(ext)) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) {
            console.log('SW: ✅ Cache hit:', request.url);
            return cached;
          }
          
          // Pas en cache : fetch + mettre en cache
          return fetch(request)
            .then(res => {
              if (res && res.status === 200) {
                caches.open(CACHE_DYN).then(cache => {
                  cache.put(request, res.clone());
                });
              }
              return res;
            })
            .catch(err => {
              console.warn('SW: ❌ Fetch failed:', request.url, err.message);
              // Retourner un fallback si possible
              return cached || new Response('Offline', {status: 503});
            });
        })
    );
    return;
  }

  // 4. Tout le reste (HTML, JSON, etc.) : Network First avec fallback cache
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE_DYN).then(cache => {
            cache.put(request, res.clone());
          });
        }
        return res;
      })
      .catch(err => {
        console.warn('SW: Fallback to cache for', request.url);
        return caches.match(request)
          .then(cached => cached || new Response('Offline', {status: 503}));
      })
  );
});

// ── Message handling pour forcer refresh du cache ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('SW: SKIP_WAITING reçu');
    self.skipWaiting();
  }
});
