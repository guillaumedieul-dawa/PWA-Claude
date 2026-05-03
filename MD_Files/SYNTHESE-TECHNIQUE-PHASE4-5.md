# 🔧 SYNTHÈSE TECHNIQUE PHASE 4-5 — Implémentation détaillée

**Date** : 03/05/2026  
**Pour** : Développeur reprenant le projet Phase 4  
**Durée lecture** : 45 minutes  
**Complexité** : Intermédiaire-Avancée

---

## 📋 Préambule

Ce document suppose que vous :
- ✅ Avez lu PHASE-3-SUMMARY.md
- ✅ Comprenez firebaseSync.js (lib Phase 1)
- ✅ Connaissez les 5 apps (todo, courses, cave, menus, colis)
- ✅ Avez accès au repo PWA-Claude-main

---

## 🏗️ Architecture Phase 4 (Real-time listeners)

### Vue globale

```
Phase 3 (actuellement)           Phase 4 (à venir)
═════════════════════════════════════════════════════

User action                      User action
    ↓                                ↓
fbWrite(data) [sync]             fbWrite(data) [sync]
    ↓                                ↓
Firestore API                    Firestore API
    ↓                                ↓
localStorage                     localStorage
    ↓                                ↓
UI render                        onSnapshot listener ← NEW!
                                     ↓
                              Instant UI update ← NEW!
```

### Components Phase 4

```
firebaseSync.js (Phase 1 — upgrade required)
  ├── fbCreateSyncHandler() — existant
  ├── fbWrite() — existant
  ├── fbReadAll() — existant
  └── fbSubscribe() ← NEW (Phase 4)
      └── onSnapshot listeners

index.html (home page)
  ├── Badge counters
  └── Real-time updates via fbSubscribe()

Chaque app (todo, courses, cave, menus, colis)
  ├── init() — appelle fbSubscribe()
  ├── listener = fbSubscribe(collection, callback)
  └── cleanup — unsubscribe on beforeunload
```

---

## 🚀 Phase 4 Implementation Details

### Step 1 : Upgrade firebaseSync.js

**Avant** (Phase 3) :
```javascript
// firebaseSync.js
function fbCreateSyncHandler(collection) {
  return {
    readAll: async () => { /* ... */ },
    write: async (id, data) => { /* ... */ },
    delete: async (id) => { /* ... */ }
  };
}
```

**Après** (Phase 4) :
```javascript
// firebaseSync.js — UPGRADE
function fbCreateSyncHandler(collection, options = {}) {
  const handler = {
    readAll: async () => { /* existant */ },
    write: async (id, data) => { /* existant */ },
    delete: async (id) => { /* existant */ },
    
    // NEW ↓
    subscribe: function(callback) {
      // Retourne unsubscribe function
      return fbSubscribeToCollection(collection, callback);
    }
  };
  return handler;
}

// NEW ↓
async function fbSubscribeToCollection(collection, callback) {
  const key = getFBKey();
  if (!key) return () => {}; // dummy unsubscribe
  
  let isUnsubscribed = false;
  
  // Polling-based subscription (Firebase SDK non utilisé)
  const interval = setInterval(async () => {
    if (isUnsubscribed) {
      clearInterval(interval);
      return;
    }
    
    try {
      const data = await fbReadAll(collection);
      if (data) callback(data);
    } catch(e) {
      console.warn('fbSubscribe polling error:', e);
    }
  }, 5000); // Poll every 5 seconds
  
  // Return unsubscribe function
  return () => {
    isUnsubscribed = true;
    clearInterval(interval);
  };
}
```

**Avantages du polling-based approach** :
- ✅ Pas de Firebase SDK (REST API only)
- ✅ Simple à tester
- ✅ Compatible Capacitor WebView
- ✅ APK ne grandit pas

**Alternative** (ajouter Firebase SDK) :
```javascript
// Si vous préférez onSnapshot réel
import { onSnapshot, query, collection } from 'firebase/firestore';

async function fbSubscribeWithSDK(collection, callback) {
  const q = query(collection(db, collection));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => fromFields(doc.data()));
    callback(data);
  });
}
```

⚠️ **Attention** : +300KB APK avec Firebase SDK. Recommandation = polling pour maintenant.

---

### Step 2 : Mettre à jour chaque app

**Exemple : todo-partage**

**Avant** (Phase 3) :
```javascript
// todo-partage/index.html
<script src="../firebaseSync.js"></script>

const todoSync = fbCreateSyncHandler('meta/todo/tasks');

async function init() {
  const tasks = await todoSync.readAll();
  loadTasks(tasks);
}

// Appel manuel (refresh via button)
async function refreshTasks() {
  const tasks = await todoSync.readAll();
  loadTasks(tasks);
}

document.addEventListener('DOMContentLoaded', init);
```

**Après** (Phase 4) :
```javascript
// todo-partage/index.html
<script src="../firebaseSync.js"></script>

const todoSync = fbCreateSyncHandler('meta/todo/tasks');
let taskListener = null; // NEW

async function init() {
  // Charger immédiatement
  const tasks = await todoSync.readAll();
  loadTasks(tasks);
  
  // NEW ↓ : S'abonner aux changements
  taskListener = todoSync.subscribe((tasks) => {
    console.log('📡 Real-time update:', tasks);
    loadTasks(tasks);
    hideSpinner(); // Sync complété
  });
}

// NEW ↓ : Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (taskListener) taskListener();
});

document.addEventListener('DOMContentLoaded', init);
```

**Impact utilisateur** :
- Guillaume crée une tâche
- Michèle voit immédiatement (sans F5)
- Latency : ~5 secondes (polling interval)

---

### Step 3 : Ajouter Syncing UI

**CSS** (dans chaque app) :
```css
/* Spinner sync */
#syncSpinner {
  position: fixed;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-top-color: #007AFF;
  border-right-color: #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 9999;
}

#syncSpinner.visible {
  opacity: 1;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**HTML** :
```html
<body>
  <div id="syncSpinner"></div>
  
  <!-- Rest of app -->
</body>
```

**JavaScript** :
```javascript
const syncSpinner = document.getElementById('syncSpinner');

function showSpinner() {
  syncSpinner.classList.add('visible');
}

function hideSpinner() {
  syncSpinner.classList.remove('visible');
}

// Update firebaseSync.js fbWrite() to show spinner
async function fbWrite(collection, id, data) {
  showSpinner();
  try {
    const result = await fetch(fbUrl(collection + '/' + id), {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({fields: toFields(data)})
    });
    // Spinner disparaît quand listener reçoit la mise à jour
    return await result.json();
  } catch(e) {
    hideSpinner(); // Cache spinner même en erreur
    throw e;
  }
}
```

---

### Step 4 : Error Handling + Retry

**Ajouter à firebaseSync.js** :
```javascript
// Config
const FB_RETRY_ATTEMPTS = 3;
const FB_RETRY_DELAY = 1000; // ms

async function fbWriteWithRetry(collection, id, data, attempt = 0) {
  try {
    return await fbWrite(collection, id, data);
  } catch(error) {
    if (attempt >= FB_RETRY_ATTEMPTS) {
      showErrorNotification(`Erreur : ${error.message}`);
      logError('fbWriteWithRetry', error, {collection, id, attempt});
      throw error;
    }
    
    const delay = Math.pow(2, attempt) * FB_RETRY_DELAY;
    console.log(`Retry attempt ${attempt + 1}/${FB_RETRY_ATTEMPTS} in ${delay}ms`);
    
    await new Promise(r => setTimeout(r, delay));
    return fbWriteWithRetry(collection, id, data, attempt + 1);
  }
}

function showErrorNotification(message) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: #FF3B30;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    animation: slideIn 0.3s;
  `;
  notif.textContent = message;
  document.body.appendChild(notif);
  
  setTimeout(() => notif.remove(), 4000);
}

function logError(context, error, data = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    context,
    error: error.message,
    ...data
  };
  console.error('ERROR LOG:', errorLog);
  // À Phase 5 : envoyer à Sentry
}
```

**Utilisation dans les apps** :
```javascript
// Remplacer fbWrite() par fbWriteWithRetry()
async function addTask() {
  const task = createTaskObject();
  try {
    await todoSync.write(task.id, task); // Déclenche retry auto
  } catch(e) {
    console.error('Failed to save task:', e);
  }
}
```

---

### Step 5 : Offline Detection

**Ajouter à firebaseSync.js** :
```javascript
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
  isOnline = true;
  console.log('🟢 Online');
  showNotification('Connexion rétablie');
  syncPendingChanges();
});

window.addEventListener('offline', () => {
  isOnline = false;
  console.log('🔴 Offline');
  showNotification('Mode hors ligne - données en cache');
});

function isCurrentlyOnline() {
  return isOnline;
}

function showNotification(message) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    top: 60px;
    left: 10px;
    background: #34C759;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
  `;
  notif.textContent = message;
  document.body.appendChild(notif);
  
  setTimeout(() => notif.remove(), 3000);
}
```

**Utilisation dans les apps** :
```javascript
async function addTask() {
  const task = createTaskObject();
  
  if (!isCurrentlyOnline()) {
    showNotification('Sauvegarde en cache (vous êtes hors ligne)');
    localStorage.setItem('pending_task_' + task.id, JSON.stringify(task));
    render();
    return;
  }
  
  try {
    await todoSync.write(task.id, task);
    render();
  } catch(e) {
    console.error('Save failed:', e);
  }
}

// Sync pending changes quand on revient online
async function syncPendingChanges() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('pending_'));
  for (const key of keys) {
    const taskJson = localStorage.getItem(key);
    const task = JSON.parse(taskJson);
    try {
      await todoSync.write(task.id, task);
      localStorage.removeItem(key);
      console.log('✅ Synced pending task:', task.id);
    } catch(e) {
      console.warn('Failed to sync pending task:', task.id, e);
    }
  }
}
```

---

## 🏗️ Architecture Phase 5 (Monitoring)

### Overview

```
Phase 5 Stack
════════════════════════════════════════════

App Code (5 apps)
    ↓
Event Tracking (fbTrackEvent)
    ├→ Sentry (errors + crashes)
    ├→ Crashlytics (analytics)
    └→ Web Vitals (performance)
    
    ↓
Backend
    ├→ Sentry Dashboard
    ├→ Firebase Analytics Console
    └→ Custom Metrics Database
```

### Step 1 : Sentry Setup

**Installation** :
```bash
npm install @sentry/browser @sentry/tracing
```

**Configuration** (ajouter à firebaseSync.js) :
```javascript
import * as Sentry from "@sentry/browser";

// Initialize Sentry
Sentry.init({
  dsn: "https://[YOUR_KEY]@sentry.io/[PROJECT_ID]",
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 1.0,
  maxBreadcrumbs: 50,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

// Capture errors automatically
window.addEventListener('error', (event) => {
  Sentry.captureException(event.error, {
    contexts: {
      error: {
        type: 'uncaught',
        source: 'window.error'
      }
    }
  });
});

window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason, {
    contexts: {
      error: {
        type: 'unhandledRejection',
        source: 'unhandledrejection'
      }
    }
  });
});
```

**Utilisation dans les apps** :
```javascript
async function fbWrite(collection, id, data) {
  try {
    // ... existing code ...
  } catch(error) {
    Sentry.captureException(error, {
      tags: {
        app: 'todo-partage',
        action: 'fbWrite',
        collection: collection
      },
      extra: {
        data: JSON.stringify(data),
        timestamp: new Date().toISOString()
      }
    });
    throw error;
  }
}
```

---

### Step 2 : Firebase Analytics

**Configuration** :
```javascript
import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';

const firebaseConfig = {
  // Récupérer depuis localStorage lt_fb
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Track custom events
function fbTrackEvent(eventName, eventData = {}) {
  logEvent(analytics, eventName, {
    timestamp: new Date().toISOString(),
    user: getUserName(), // 'Guillaume' ou 'Michèle'
    app: getCurrentApp(),
    ...eventData
  });
}

// Utilisation
fbTrackEvent('todo_created', { 
  title: task.title,
  priority: task.priority 
});

fbTrackEvent('colis_received', { 
  shipper: 'UPS',
  tracking_number: number 
});

fbTrackEvent('error_firestore', {
  error_code: 'PERMISSION_DENIED',
  operation: 'fbWrite'
});
```

---

### Step 3 : Web Vitals

**Installation** :
```bash
npm install web-vitals
```

**Configuration** :
```javascript
import { getCLS, getFID, getLCP, getINP, getTTFB } from 'web-vitals';

function sendMetric(metric) {
  // Send to Sentry + Analytics
  console.log('📊 Web Vital:', metric.name, metric.value);
  
  Sentry.captureMessage(`Web Vital: ${metric.name}`, 'info', {
    tags: { metric_name: metric.name },
    extra: {
      value: metric.value,
      rating: metric.rating // 'good', 'needs-improvement', 'poor'
    }
  });
  
  fbTrackEvent('web_vital_' + metric.name.toLowerCase(), {
    value: metric.value,
    rating: metric.rating
  });
}

// Measure all vitals
getCLS(sendMetric);
getFID(sendMetric);
getLCP(sendMetric);
getINP(sendMetric);
getTTFB(sendMetric);
```

---

## 📊 Testing Strategy Phase 4-5

### Phase 4 Tests

```javascript
// firebaseSync.test.js — Tests Phase 4

describe('fbSubscribe', () => {
  test('should call callback on data change', async () => {
    const callback = jest.fn();
    const unsubscribe = todoSync.subscribe(callback);
    
    await sleep(5500); // Attendre polling
    expect(callback).toHaveBeenCalled();
    
    unsubscribe();
  });
  
  test('should unsubscribe properly', async () => {
    const callback = jest.fn();
    const unsubscribe = todoSync.subscribe(callback);
    
    unsubscribe();
    await sleep(5500);
    
    // Ne doit pas être appelé après unsubscribe
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('Error Handling', () => {
  test('should retry on network error', async () => {
    const data = {id: '1', title: 'Test'};
    
    // Mock fetch to fail 2 times, succeed 3rd
    let attempts = 0;
    global.fetch = jest.fn(() => {
      attempts++;
      if (attempts < 3) throw new Error('Network error');
      return Promise.resolve({json: () => ({success: true})});
    });
    
    const result = await fbWriteWithRetry('collection', '1', data);
    expect(attempts).toBe(3);
    expect(result.success).toBe(true);
  });
});

describe('Offline Detection', () => {
  test('should detect online/offline', () => {
    expect(isCurrentlyOnline()).toBe(true);
    
    // Simulate offline
    window.dispatchEvent(new Event('offline'));
    expect(isCurrentlyOnline()).toBe(false);
    
    // Back online
    window.dispatchEvent(new Event('online'));
    expect(isCurrentlyOnline()).toBe(true);
  });
});
```

### Phase 5 Tests

```javascript
describe('Sentry Integration', () => {
  test('should capture errors to Sentry', () => {
    const captureExceptionSpy = jest.spyOn(Sentry, 'captureException');
    
    try {
      throw new Error('Test error');
    } catch(e) {
      fbWrite(collection, id, data); // Will trigger error
    }
    
    expect(captureExceptionSpy).toHaveBeenCalled();
  });
});

describe('Analytics Tracking', () => {
  test('should log events', () => {
    const logEventSpy = jest.spyOn(analytics, 'logEvent');
    
    fbTrackEvent('test_event', {data: 'value'});
    
    expect(logEventSpy).toHaveBeenCalledWith('test_event', expect.any(Object));
  });
});
```

---

## 🔍 Debugging Guide

### Phase 4 Issues

**Listener pas appelé** :
```javascript
// Debug : vérifier polling
console.log('Polling active?', todoSync.subscribe !== undefined);
console.log('Online?', isCurrentlyOnline());
console.log('FBKey present?', getFBKey().length > 0);
```

**Spinner ne disparaît pas** :
```javascript
// Vérifier listener callback appelle hideSpinner()
taskListener = todoSync.subscribe((tasks) => {
  console.log('📡 Callback called'); // Should log
  loadTasks(tasks);
  hideSpinner();
});
```

**Retry loop infini** :
```javascript
// Vérifier maxRetries
async function fbWriteWithRetry(..., maxRetries = 3) {
  if (attempt >= maxRetries) {
    throw error; // Must throw
  }
}
```

### Phase 5 Issues

**Sentry DSN invalide** :
```javascript
// Vérifier DSN format
// https://[KEY]@sentry.io/[PROJECT_ID]
console.log('Sentry DSN:', Sentry.getCurrentHub().getClient()?.getOptions().dsn);
```

**Firebase Analytics ne log pas** :
```javascript
// Vérifier que analytics est initialisé
console.log('Analytics ready?', analytics !== undefined);
logEvent(analytics, 'test', {timestamp: new Date().toISOString()});
```

---

## ✅ Checklist implémentation

### Phase 4

- [ ] firebaseSync.js : ajouter fbSubscribe()
- [ ] firebaseSync.js : ajouter fbSubscribeToCollection()
- [ ] todo-partage : init() appelle todoSync.subscribe()
- [ ] todo-partage : beforeunload cleanup
- [ ] liste-courses : même pattern que todo
- [ ] cave-spiritueux : même pattern que todo
- [ ] menus-semaine : même pattern que todo
- [ ] locker-tracker : même pattern que todo
- [ ] Ajouter CSS spinner
- [ ] Ajouter showSpinner() / hideSpinner()
- [ ] firebaseSync.js : ajouter fbWriteWithRetry()
- [ ] Utiliser fbWriteWithRetry() au lieu fbWrite()
- [ ] firebaseSync.js : ajouter online/offline detection
- [ ] Tests unit firebaseSync + retry
- [ ] Tests APK Phase 4 (2 devices)
- [ ] Documenter résultats dans TEST-REPORT-PHASE4.md

### Phase 5

- [ ] npm install @sentry/browser @sentry/tracing
- [ ] firebaseSync.js : Sentry.init()
- [ ] firebaseSync.js : window.error listener
- [ ] firebaseSync.js : unhandledrejection listener
- [ ] Chaque app : fbTrackEvent() pour actions clés
- [ ] npm install firebase (si pas déjà)
- [ ] firebaseSync.js : getAnalytics()
- [ ] firebaseSync.js : fbTrackEvent() function
- [ ] npm install web-vitals
- [ ] firebaseSync.js : setup Web Vitals
- [ ] Créer compte Sentry (sentry.io)
- [ ] Créer compte Firebase Analytics Console
- [ ] Tests unit Sentry + Analytics
- [ ] Tests APK Phase 5 (2 devices)
- [ ] Documenter résultats dans TEST-REPORT-PHASE5.md

---

## 📚 Références

**Phase 4** :
- Polling approach : Simple, REST API only
- onSnapshot real SDK : +300KB APK
- Recommended : Start polling, upgrade later if needed

**Phase 5** :
- Sentry docs : https://docs.sentry.io/platforms/javascript/
- Firebase Analytics : https://firebase.google.com/docs/analytics
- Web Vitals : https://web.dev/vitals/

---

**Généré** : 03/05/2026 - 10:40 UTC  
**Prêt pour implémentation Phase 4**
