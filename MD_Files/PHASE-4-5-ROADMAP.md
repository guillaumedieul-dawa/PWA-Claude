# 🚀 PHASE-4-5-ROADMAP.md — Plan détaillé futures phases

**Date** : 03/05/2026  
**Version** : v1.0  
**Status** : 📋 PLANIFICATION (non encore commencée)

---

## 🎯 Vue d'ensemble

Après Phase 3 (refactorisation 100% complète), deux phases restantes pour industrialiser FamilyHub v2 :

- **Phase 4** : Real-time & Offline-first (2-3 semaines)
- **Phase 5** : Monitoring & Analytics (2-3 semaines)

---

## 📊 Décision critique Phase 4

### Option A : Real-time listeners PRIORITAIRE

**Avantages** :
- ✅ Synchronisation < 1s (vs 200-300ms actuels)
- ✅ Deux utilisateurs voient les changements instantanément
- ✅ Meilleure UX (pas besoin de F5)
- ✅ Implémentation plus simple

**Inconvénients** :
- ❌ Consomme plus de batterie (listeners actifs)
- ❌ Requiert Firebase SDK (+300KB APK)

**Effort** : ~1-2 semaines

---

### Option B : Offline-first PRIORITAIRE

**Avantages** :
- ✅ Fonctionne sans réseau
- ✅ Performance immédiate (données locales)
- ✅ Économise batterie (pas de listeners constants)

**Inconvénients** :
- ❌ Sync complexe (conflict resolution)
- ❌ Requiert IndexedDB + synchronisation
- ❌ Ui showing "syncing..." states

**Effort** : ~2-3 semaines

---

### Recommandation

**Option A (Real-time) + Option B (future)**

Raison : 
1. Real-time = impact UX immédiat
2. Offline-first = amélioration future (moins urgent pour app familiale)
3. Phasing : Real-time en Phase 4, Offline en Phase 5+ optionnel

---

## 📋 PHASE 4 — Real-time & Offline (2-3 semaines)

### Objectif

Ajouter `onSnapshot()` listeners pour synchronisation temps réel entre Guillaume & Michèle.

### Livrables

#### 1. Real-time listeners (onSnapshot)

**Implémentation** :
```javascript
// Avant (fetch manuel)
async function fbLoadAll() {
  const response = await fetch(fbUrl(collection));
  return parseDocuments(response);
}

// Après (real-time)
async function fbSubscribe(collection, callback) {
  return onSnapshot(
    query(collection(db, collection)),
    (snapshot) => {
      const data = snapshot.docs.map(doc => fromFields(doc.data()));
      callback(data);
    }
  );
}
```

**Where** :
- firebaseSync.js update (ajouter exports onSnapshot)
- Chaque app crée une subscription au démarrage

**Effort** : 5-7 jours

---

#### 2. Unsubscribe on cleanup

```javascript
// Éviter memory leaks
function fbUnsubscribe(listener) {
  if (listener) listener(); // Firebase returns unsubscribe function
}

// App init
let tasksListener = null;

async function init() {
  tasksListener = fbSubscribe('meta/todo/tasks', (data) => {
    tasks = data;
    render();
  });
}

// App cleanup (quand user ferme)
window.addEventListener('beforeunload', () => {
  fbUnsubscribe(tasksListener);
});
```

**Effort** : 2-3 jours

---

#### 3. "Syncing..." UI indicator

```javascript
// État sync global
let isSyncing = false;

function startSync() { isSyncing = true; updateUI(); }
function stopSync() { isSyncing = false; updateUI(); }

// Dans firebaseSync.js
async function fbWrite(...) {
  startSync();
  try {
    await fetch(...);
    stopSync();
  } catch(e) {
    stopSync();
    showError(e);
  }
}
```

**UI** :
- Spinner animé en haut de chaque app
- "Syncing..." text
- Disparaît une fois complété

**Effort** : 3-4 jours

---

#### 4. Error handling avancé

```javascript
// Retry logic avec backoff exponentiel
async function fbWriteWithRetry(collection, id, data, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fbWrite(collection, id, data);
    } catch(error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

**Effort** : 2-3 jours

---

#### 5. Offline detection

```javascript
// Détecte online/offline
window.addEventListener('online', () => {
  showNotification('Connexion rétablie');
  syncPendingChanges();
});

window.addEventListener('offline', () => {
  showNotification('Mode hors ligne - données mises en cache localement');
});
```

**Effort** : 1-2 jours

---

### Implémentation détaillée Phase 4

**Semaine 1** :
- Jour 1-2 : Real-time listeners (onSnapshot)
- Jour 3-4 : Unsubscribe & cleanup
- Jour 5 : Tests premiers listeners

**Semaine 2** :
- Jour 1-2 : "Syncing..." UI + animations
- Jour 3-4 : Error handling + retry logic
- Jour 5 : Tests APK complète

**Semaine 3** (si nécessaire) :
- Jour 1-2 : Offline detection + UI
- Jour 3-4 : Performance optimization
- Jour 5 : Final testing & documentation

### Validation Phase 4

**Tests requis** :
- [ ] Real-time sync fonctionne (< 1s latency)
- [ ] Deux users voient les changements instantanément
- [ ] Pas de memory leaks (unsubscribe OK)
- [ ] APK testée sur 2 devices
- [ ] Performance acceptable (batterie)
- [ ] Offline detection fonctionne
- [ ] Syncing UI s'affiche/disparaît correctement

### Métriques attendues Phase 4

```
Latence sync : 200-300ms → < 1s (real-time listeners)
APK taille   : ~164 KB → ~170 KB (+6 KB pour onSnapshot)
Batterie     : Impact minime (listeners = polling < 5s)
UX           : Excellent (changements instantanés)
```

---

## 📋 PHASE 5 — Monitoring & Analytics (2-3 semaines)

### Objectif

Ajouter monitoring de production + analytics pour suivre la santé de l'app.

### Livrables

#### 1. Sentry (Error Tracking)

**Installation** :
```bash
npm install @sentry/browser @sentry/tracing
```

**Configuration** :
```javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "https://[KEY]@sentry.io/[PROJECT_ID]",
  environment: "production",
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

**Utilisation** :
```javascript
try {
  await fbWrite(...);
} catch(error) {
  Sentry.captureException(error, {
    tags: { app: 'todo-partage', action: 'fbWrite' }
  });
  showUserError('Erreur lors de la sauvegarde');
}
```

**Effort** : 3-4 jours

---

#### 2. Firebase Crashlytics (Alternative)

```javascript
import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';

const analytics = getAnalytics();

try {
  await fbWrite(...);
  logEvent(analytics, 'todo_created', { app: 'todo-partage' });
} catch(error) {
  logEvent(analytics, 'error_fbwrite', {
    error_code: error.code,
    collection: collection
  });
}
```

**Effort** : 2-3 jours

---

#### 3. Web Vitals Monitoring

```javascript
import { getCLS, getFID, getLCP, getINP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Send to Sentry/Crashlytics/Custom backend
  console.log(metric);
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getLCP(sendToAnalytics);
getINP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

**Metrics** :
- **CLS** (Cumulative Layout Shift) : Stabilité visuelle
- **FID** (First Input Delay) : Réactivité
- **LCP** (Largest Contentful Paint) : Chargement
- **INP** (Interaction to Next Paint) : Responsivité
- **TTFB** (Time to First Byte) : Serveur

**Effort** : 2-3 jours

---

#### 4. Custom Analytics Dashboard

```javascript
// Log toutes les actions principales
function trackEvent(action, data = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    action,
    user: getUserId(), // Guillaume or Michèle
    app: getCurrentApp(),
    ...data
  };
  
  // Envoyer à Firebase Analytics ou endpoint custom
  logEvent(analytics, action, event);
}

// Utilisation
trackEvent('todo_created', { title: task.title });
trackEvent('colis_received', { shipper: 'UPS' });
trackEvent('shopping_list_updated', { items_count: 10 });
```

**Dashboard** :
- Fréquence d'usage (Guillaume vs Michèle)
- Transporteurs les plus utilisés
- Temps moyen d'une tâche
- Erreurs les plus fréquentes

**Effort** : 4-5 jours

---

#### 5. Performance Profiling

```javascript
// Mesurer latence Firebase
function measureFbLatency() {
  const start = performance.now();
  
  fbLoadAll().then(() => {
    const end = performance.now();
    const latency = end - start;
    
    logEvent(analytics, 'firestore_latency', {
      latency_ms: latency,
      collection: 'meta/todo/tasks'
    });
  });
}

// Mesurer render time
function measureRenderTime() {
  const start = performance.now();
  render(); // DOM update
  const end = performance.now();
  
  console.log(`Render time: ${end - start}ms`);
}
```

**Targets** :
- Firestore latency : < 500ms
- Render time : < 100ms
- App startup : < 1s

**Effort** : 3-4 jours

---

### Implémentation détaillée Phase 5

**Semaine 1** :
- Jour 1-2 : Sentry setup + error tracking
- Jour 3-4 : Firebase Crashlytics setup
- Jour 5 : Tests logging

**Semaine 2** :
- Jour 1-2 : Web Vitals monitoring
- Jour 3-4 : Custom analytics events
- Jour 5 : Dashboard setup

**Semaine 3** (si nécessaire) :
- Jour 1-2 : Performance profiling
- Jour 3-4 : Optimization basée sur metrics
- Jour 5 : Final testing & documentation

### Validation Phase 5

**Tests requis** :
- [ ] Erreurs sont loggées dans Sentry
- [ ] Web Vitals sont mesurées
- [ ] Dashboard affiche les metrics
- [ ] Aucun privacy leak (données sensibles)
- [ ] Performance pas dégradée par logging

### Métriques attendues Phase 5

```
Error tracking : 100% des crashes loggés
Analytics coverage : 95%+ des actions trackées
Dashboard latency : < 500ms pour charger
Privacy : RGPD compliant (pas de données perso)
```

---

## 🗓️ Timeline complète Phase 4-5

```
Semaine du 05/05 : Fin Phase 3 testing + décision Phase 4
Semaine du 12/05 : Phase 4 semaine 1 (Real-time)
Semaine du 19/05 : Phase 4 semaine 2 (Syncing UI + Error handling)
Semaine du 26/05 : Phase 4 semaine 3 (optionnelle)
Semaine du 02/06 : Phase 4 testing APK + décision Offline-first
Semaine du 09/06 : Phase 5 semaine 1 (Sentry + Crashlytics)
Semaine du 16/06 : Phase 5 semaine 2 (Analytics)
Semaine du 23/06 : Phase 5 testing + optimisations
Semaine du 30/06 : ✅ PRODUCTION READY

Total : ~8 semaines supplémentaires
```

---

## 💰 Estimation effort

| Phase | Semaines | FTE | Effort total |
|-------|----------|-----|--------------|
| Phase 4 | 2-3 | 1 | 80-120h |
| Phase 5 | 2-3 | 1 | 80-120h |
| **Total** | **4-6** | **1** | **160-240h** |

**Pour contexte** : Phase 1-3 = ~15h (refactorisation), Phase 4-5 = ~200h (nouvelles features)

---

## 📊 Priorisation post-Phase 3

### Must-have (Phase 4)
- ✅ Real-time listeners (onSnapshot)
- ✅ Syncing UI indicator
- ✅ Basic error handling

### Should-have (Phase 5)
- ✅ Sentry error tracking
- ✅ Basic analytics
- ✅ Web Vitals monitoring

### Nice-to-have (Phase 6+)
- ⭐ Offline-first synchronization
- ⭐ Advanced conflict resolution
- ⭐ Comprehensive dashboard
- ⭐ ML-based recommendations

---

## 🚀 Next steps (Après Phase 3)

### Immédiat (cette semaine)
1. ✅ Tester APK Phase 3 sur devices (2h)
2. ✅ Documenter résultats tests (30 min)
3. ✅ Mettre à jour PROJECT-STATUS.md (30 min)
4. ✅ Décider : Real-time ou Offline-first ? (30 min)

### Phase 4 prep (semaine prochaine)
5. ⏳ Planifier sprint Phase 4 (2h)
6. ⏳ Setup Sentry/Crashlytics accounts (30 min)
7. ⏳ Créer backlog Phase 4 (1h)

### Phase 4 launch (semaine du 12/05)
8. ⏳ Implémenter onSnapshot listeners
9. ⏳ Ajouter Syncing UI
10. ⏳ Tests APK Phase 4

---

## 📞 Décision requise

**À Guillaume & Michèle** :

> Phase 4 : Voulez-vous Real-time listeners (synchronisation instantanée < 1s) ou Offline-first (fonctionne sans internet) en PRIORITÉ ?
>
> - **Option A** (Recommandée) : Real-time en Phase 4, Offline-first optionnel Phase 6+
> - **Option B** : Offline-first en Phase 4, Real-time Phase 5
>
> Réponse requise avant 05/05/2026 pour démarrer Phase 4.

---

**Roadmap v1.0 : ✅ FINALISÉE**

En attente de décision Phase 4 pour démarrage.

Generated: 03/05/2026 - 10:25 UTC
