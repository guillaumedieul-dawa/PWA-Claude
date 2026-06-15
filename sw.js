// ══════════════════════════════════════════
//  FamilyHub — Service Worker v7 OPTIMIZED
// ══════════════════════════════════════════

const VERSION      = '8';
const CACHE_STATIC = 'fh-static-v' + VERSION;
const CACHE_DYN    = 'fh-dyn-v'    + VERSION;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/themes.css',   // <-- Ajout du fichier CSS des thèmes
  '/theme.js',     // <-- Ajout du script des thèmes
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
          // ignoreSearch permet de faire correspondre /index.html même si l'URL a des paramètres
          return caches.match(request, { ignoreSearch: true }).then(r => {
            if (r) return r;
            const segments = url.pathname.split('/');
            const subApp = segments[1];
            const subAppIndex = `/${subApp}/index.html`;
            return STATIC_ASSETS.includes(subAppIndex) 
              ? caches.match(subAppIndex, { ignoreSearch: true }) 
              : caches.match('/index.html', { ignoreSearch: true });
          });
        })
    );
    return;
  }

  const ext = url.pathname.split('.').pop().toLowerCase();
  const staticExts = ['js', 'css', 'png', 'svg', 'ico', 'woff', 'woff2', 'jpg', 'jpeg', 'gif', 'webp'];
  
  if (staticExts.includes(ext)) {
    event.respondWith(
      // L'ajout critique de { ignoreSearch: true } permet de contourner les bugs liés à ?v=1
      caches.match(request, { ignoreSearch: true }).then(cached => {
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
    }).catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || new Response('Offline', { status: 503 })))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Firebase Cloud Messaging — Push Notifications ─────────────
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyDgjLxRdUP4NzLCCXzaourqOB2_A1vt5aA',
  projectId:         'familyhub-colis-8abbd',
  messagingSenderId: '97858140929',
  appId:             '1:97858140929:web:dce8473f387e48d514b900',
});

var _messaging = firebase.messaging();

// Notification en background (app fermée ou en arrière-plan)
_messaging.onBackgroundMessage(function(payload) {
  var data    = payload.data || {};
  var title   = data.title   || '📦 FamilyHub';
  var body    = data.body    || 'Mise à jour colis';
  var icon    = '/icons/home-192.png';
  var badge   = '/icons/home-192.png';
  var tag     = data.tag     || 'fh-notif';
  var url     = data.url     || '/locker-tracker/index.html';

  self.registration.showNotification(title, {
    body:  body,
    icon:  icon,
    badge: badge,
    tag:   tag,
    data:  { url: url },
    vibrate: [200, 100, 200],
    requireInteraction: ['ready', 'out_for_delivery'].indexOf(data.status) >= 0,
  });
});

// Clic sur la notification → ouvre locker-tracker
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/locker-tracker/index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('locker-tracker') >= 0) {
          return list[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
