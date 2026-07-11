# Journal de Projet — FamilyHub v2

**Dernière mise à jour** : 11 juillet 2026  
**Repo** : https://github.com/guillaumedieul-dawa/PWA-Claude  
**Firebase** : `familyhub-colis-8abbd`

---

## 📋 Résumé Exécutif

FamilyHub est une **PWA Capacitor v8 distribuée en APK Android** via GitHub Actions. Elle sert deux utilisateurs : Guillaume et Michèle (famille Dieul-Gandet, Pierrelaye 95480).

**Stack technique** : HTML/CSS/JS natif · Firestore REST API (no SDK) · localStorage cache/offline · Capacitor v8 · GitHub Actions

**Profil développeur** : Développement exclusivement sur téléphone portable. Toutes les livraisons sont des fichiers ZIP déployés via `push-familyhub.html`.

---

## 🏗️ Architecture

### Arborescence repo

```
repo-github/
├── index.html                    ← Hub principal (accueil 5 modules)
├── themes.css                    ← Système 3 thèmes (light/dark/sepia)
├── theme.js                      ← IIFE thème, sélecteur pastilles
├── fbSync.js                     ← Bibliothèque Firebase REST (externe)
├── sw.js                         ← Service Worker v8 + Firebase Messaging
├── manifest.json
├── capacitor.config.json
├── package.json
├── locker-tracker/index.html     ← Module colis (principal)
├── todo-partage/index.html
├── liste-courses/index.html
├── cave-spiritueux/index.html
├── menus-semaine/index.html
├── android-src/                  ← Sources Android custom
│   ├── SmsPlugin.java
│   ├── MainActivity.java
│   └── (google-services.json → GitHub Secret GOOGLE_SERVICES_JSON)
├── .github/workflows/
│   └── build-apk.yml
├── Code-Tracker.gs               ← Apps Script : scraping transporteurs
├── Code-Notif.gs                 ← Apps Script : notifications FCM V1
├── Code-Import.gs                ← Apps Script : import emails Gmail
├── ScriptGoogleGMAIL-v2.gs       ← Apps Script : parsing Gmail (existant)
└── push-familyhub.html           ← Outil deploy ZIP → GitHub → APK
```

### Firebase / Firestore

- **Project ID** : `familyhub-colis-8abbd`
- **Application Android** : `com.famille.dieulgandet` (packageName)
- **Collections** :
  - `colis/{id}` — colis trackés
  - `meta/todo/tasks/{id}` — tâches partagées
  - `meta/courses/items/{id}` — liste de courses
  - `meta/cave/bottles/{id}` — cave à spiritueux
  - `meta/menus/{dateKey}` — menus semaine
  - `meta/fcmTokens/{account}` — tokens FCM push (Guillaume/Michele)
  - `meta/lastTrackerSync` — log scraping auto
  - `meta/lastGmailImport` — log import Gmail
  - `meta/carrierConfig` — config transporteurs (jours, lien perso, actif) cross-compte
  - `meta/appSettings` — **(11/07)** réglages app partagés cross-compte (`trackerWebhook`)

### Clés localStorage

| Clé | Usage |
|-----|-------|
| `lt_v3` | Données colis locales |
| `lt_fb` | Config Firebase (projectId + apiKey) |
| `lt_ret` | Délais expiration par transporteur |
| `lt_logs` | Logs SMS/Firebase/Gmail |
| `lt_disabled` | Transporteurs désactivés |
| `lt_tracker_wh` | URL webhook Code-Tracker.gs |
| `lt_purge_days` | Délai purge colis (défaut: 20j) |
| `fh_todo` | Todo local |
| `fh_courses` | Courses local |
| `fh_cave` | Cave local |
| `fh_menus` | Menus local |
| `fh_theme` | Thème actif (light/dark/sepia) |
| `fh_fcm_token` | Token FCM en cache (avant config Firebase) |
| `fh_fcm_account` | Compte associé au token FCM |

---

## ✅ Phases complétées

### Phase 1 — Bootstrap [✅ TERMINÉ]
- Repo GitHub créé avec structure de base
- GitHub Actions workflow (`build-apk.yml`) configuré
- Premier APK généré et installé
- Plugin SmsPlugin Capacitor intégré

### Phase 2 — 5 Modules fonctionnels [✅ TERMINÉ]
- `locker-tracker` : suivi colis avec SMS parsing, QR, Firebase sync
- `todo-partage` : tâches communes G+M avec priorités et échéances
- `liste-courses` : liste partagée par magasin
- `cave-spiritueux` : inventaire vins/spiritueux
- `menus-semaine` : planification repas hebdo
- Système de thèmes `themes.css` + `theme.js` (light/dark/sepia)
- Panel debug `DBG` intégré dans locker-tracker

### Phase 3 — APK WebView Refactor [✅ TERMINÉ · validé device]

**21 bugs Capacitor WebView corrigés :**

| Bug | Fix |
|-----|-----|
| `onclick=` inline partout | Migration `data-action` + dispatcher `findAction()` |
| `e.target.closest()` crash TextNode | Guard `el.nodeType===1` dans `findAction()` |
| `classList` sans reflow | `void el.offsetHeight` dans `openSheet()` |
| String IDs Firebase castés Number | `String(id)` direct |

**Pattern dispatcher (obligatoire dans tous les modules) :**
```javascript
function findAction(elem) {
  var el = elem;
  while (el && el !== document) {
    if (el.nodeType === 1 && el.getAttribute && el.getAttribute('data-action')) return el;
    el = el.parentNode;
  }
  return null;
}
```

**Pattern openSheet (obligatoire) :**
```javascript
function openSheet(id) {
  const el = document.getElementById(id);
  el.style.cssText = 'position:fixed;inset:0;...display:flex;...';
  void el.offsetHeight; // FIX: reflow Capacitor
}
```

### Phase 3.5 — Import 41 colis Gmail [✅ TERMINÉ]

**`Code-Import.gs`** (Apps Script) :
- Recherche Gmail 365 derniers jours (mots-clés: colis, suivi, livraison…)
- Détection auto 12 transporteurs
- Extraction: numéro suivi, code retrait, adresse, lien, statut
- Déduplication par numéro de suivi
- Résultat: **41 colis importés, 0 erreurs, 96 fils traités en 53 secondes**

Fonction à exécuter : `importGmailColis()`

### Phase 4 — Real-time Sync Firebase [✅ TERMINÉ]

**`fbSync.js`** (externe, chargé via `<script src>`) :
- Polling REST Firestore toutes les **5 secondes** (`fbSubscribe()`)
- Pause automatique sur `visibilitychange` (app en arrière-plan)
- Write queue persistée en localStorage (`fb_wq`) avec retry exponentiel
- `FBSync.write()` / `FBSync.delete()` / `FBSync.subscribe()` / `FBSync.ui`

**Bug Phase 4 corrigé** : script externe bloquant → inliné dans locker-tracker (résolu depuis)

**Bug Phase 4 v2** : `}` orphelin ligne 113 (résidu regex) → détecté par `node --check`, supprimé.

> **Règle absolue** : toujours `node --check` sur chaque bloc `<script>` après tout patch regex.

### Phase 5 — Tracking auto transporteurs [✅ TERMINÉ]

**`Code-Tracker.gs`** (Apps Script) :
- Trigger horaire (1×/heure) via `trackAllPackages()`
- Lit les colis actifs depuis Firestore
- Scrape les URLs de suivi transporteur via `UrlFetchApp` (CORS-free)
- Parser HTML : détection statut, code retrait, adresse relais
- `MAX_PER_RUN = 10` (évite timeout 6 min Google Apps Script)
- `SKIP_IF_UPDATED_WITHIN = 90 min` (évite rescraping inutile)
- Écrit le statut mis à jour dans Firestore → Phase 4 polling rafraîchit l'app
- Déploié en Web App → URL webhook configurée dans locker-tracker (Config)

**Bouton 🔄** dans la tbar locker-tracker → force le scraping immédiatement.

**Transporteurs supportés** : Chronopost, Chronofresh, Colissimo, La Poste, Mondial Relay, DPD, UPS, GLS, Relais Colis, Vinted Go, Amazon, Autre.

### Phase 6 — Notifications push FCM [🔄 EN COURS]

**Objectif** : notification native Android quand colis `ready`, `out_for_delivery`, `delivered`.

**Architecture** :
```
APK (Capacitor PushNotifications plugin)
  → FCM token enregistré dans Firestore meta/fcmTokens/Guillaume|Michele
Code-Tracker.gs (détecte changement statut)
  → appelle Code-Notif.gs
  → FCM V1 API (https://fcm.googleapis.com/v1/projects/.../messages:send)
  → Bearer OAuth ScriptApp.getOAuthToken()
  → notification native sur les 2 téléphones
```

**Fichiers** :
- `@capacitor/push-notifications: 8.0.0` dans `package.json`
- `PushNotifications` plugin configuré dans `capacitor.config.json`
- `android-src/google-services.json` → **GitHub Secret `GOOGLE_SERVICES_JSON`** (base64)
- `Code-Notif.gs` : envoi FCM V1, lecture tokens Firestore, templates par statut
- `Code-Tracker.gs` : patché pour appeler `sendStatusNotification(pkg, newStatus)`
- `appsscript.json` : scope `firebase.messaging` ajouté
- `sw.js v8` : handler `pushNotificationReceived` pour foreground
- `locker-tracker/index.html` : `initPush()` → `PushNotifications.requestPermissions()` + `register()` + `_saveFCMToken()`

**Problèmes rencontrés et solutions** :
- Organisation Google bloque `iam.disableServiceAccountKeyCreation` → pas de clé de service → utilisation `ScriptApp.getOAuthToken()` (FCM V1)
- Ancienne API FCM désactivée → FCM V1 obligatoire
- Web Push / VAPID ne fonctionne pas dans Android WebView Capacitor → plugin natif obligatoire
- `applicationId` incohérent (`.app` suffix dans workflow) → supprimé, uniformisé à `com.famille.dieulgandet`
- `google-services.json` committé public → alerte GitHub Secret Scanning → migré en GitHub Secret base64
- Token FCM non sauvegardé si Firebase pas configuré au moment du register → fix : cache localStorage `fh_fcm_token` + flush via `_flushCachedFCMToken()` quand Firebase configuré

**État actuel** :
- ✅ APK buildé avec plugin natif
- ✅ Permission notification accordée sur le téléphone
- ⏳ Token FCM pas encore dans Firestore (cause: apiKey manquante après réinstall)
- **Action requise** : configurer Firebase dans l'app → fermer/rouvrir → `testNotification()` dans Apps Script

---

## 🔧 Patch 11/07/2026 — Webhook tracker éditable + sync Firestore

### Bug signalé
Champ URL webhook (`Code-Tracker.gs` déployé) : perçu comme "chargé depuis Firestore mais plus éditable". Cause probable : stockage `lt_tracker_wh` **localStorage uniquement**, aucun sync `meta/appSettings` réellement présent dans le code live (vérifié sur `locker-tracker/index.html` fourni ce jour) → pas partagé entre comptes/appareils, et vidé si l'APK est réinstallée (même classe de bug que le token FCM Phase 6).

### Fix `locker-tracker/index.html`
- Nouveau doc Firestore `meta/appSettings` (champ `trackerWebhook`), même pattern que `meta/carrierConfig`.
- `fetchTrackerWhFromFirestore()` / `writeTrackerWhToFirestore(wh)` — lecture/écriture REST avec `updateMask.fieldPaths`.
- `bindTrackerWh()` : affiche le cache local instantanément à l'ouverture de l'onglet Transporteurs, puis rafraîchit depuis Firestore (ne touche pas le champ si `document.activeElement===el`, pour ne jamais écraser une saisie en cours).
- `saveTrackerWh()` (async) : écrit localStorage **et** Firestore, 2 toasts séquentiels (local puis cloud).
- Init page : `initTrackerWh()` (même pattern IIFE que `initTrCfg()`) → cache local toujours à jour même sans ouvrir l'onglet Admin, pour que `forceTrack()` utilise la dernière URL.
- `forceTrack()` non modifié (continue de lire `lt_tracker_wh`, désormais fiable).

### ⚠️ Écart détecté KB
Une version de ce journal datée 04/07/2026 (liens de suivi stables + réorg onglets `tSy/SM/tTr/tCf/tLg`) circule mais **ne correspond pas** au code réellement livré (toujours 3 onglets BDD/Transporteurs/Logs). Ce patch a été appliqué sur la base réelle (16/06), pas sur la version 04/07 non confirmée. À vérifier : la version 04/07 a-t-elle été réellement déployée sur GitHub ?

### Bug #2 — "Webhook error: failed to fetch" au scraping — 🔎 DIAGNOSTIC EN COURS
Aucun fix appliqué (cause non confirmée). Pistes : accès déploiement Apps Script ≠ "Anyone", déploiement obsolète/supprimé, ou redirection Google. Questions posées à Guillaume (voir échange).

---

## 🔑 Règles techniques critiques

| Règle | Détail |
|-------|--------|
| `node --check` | Obligatoire après tout patch regex sur un `<script>` |
| Reflow Capacitor | `void el.offsetHeight` après changement style/classList sur overlay |
| Event delegation | `data-action` + `findAction()`, jamais `onclick=` inline |
| TextNode guard | `el.nodeType===1` avant tout `getAttribute` dans `findAction()` |
| Firebase IDs | Toujours `String(id)`, jamais `Number()` / `Math.round()` |
| Champs Firestore | Toujours `toFields()` avec encodage explicite booléens |
| Champs internes | Exclure les champs `_`-préfixés des payloads Firestore |
| Scripts externes | Jamais en `<head>` sans `defer`. Inliner les modules critiques |
| Secrets GitHub | Jamais de clé API en clair dans le repo (base64 → Secret) |
| Write queue | Toutes écritures Firebase via `FBSync.write()` pour retry auto |
| Apps Script timeout | Max 10 items/run, skip si récent (`SKIP_IF_UPDATED_WITHIN`) |
| FCM token | Cache localStorage si Firebase pas encore configuré → flush au saveFB |
| Réglages partagés | **(11/07)** Tout champ cross-compte (webhook, futurs settings) → `meta/appSettings`, jamais localStorage seul. Refresh Firestore→UI toujours gardé par `document.activeElement` pour ne pas écraser une saisie. |

---

## 📦 Gestion des livrables

**Format** : fichier ZIP horodaté UTC, arborescence GitHub complète.  
**Déploiement** : `push-familyhub.html` → ZIP drop → push GitHub → trigger GitHub Actions.

**Règle patch** : appliquer sur le fichier GitHub actuel (`curl` depuis `raw.githubusercontent.com`), pas depuis un cache local.

---

## 🚀 Roadmap

| Phase | État | Description |
|-------|------|-------------|
| Phase 1 | ✅ | Bootstrap, repo, GitHub Actions |
| Phase 2 | ✅ | 5 modules fonctionnels |
| Phase 3 | ✅ | APK WebView refactor (21 bugs) |
| Phase 3.5 | ✅ | Import 41 colis Gmail |
| Phase 4 | ✅ | Real-time sync polling 5s |
| Phase 5 | ✅ | Tracking auto scraping horaire |
| Phase 6 | 🔄 | Push notifications FCM natif Android |
| Phase 7 | ⏳ | Michèle : config compte + token FCM |
| Phase 8 | ⏳ | Menus → liste de courses auto |

---

## 📝 Apps Script — Fonctions disponibles

| Fichier | Fonction | Déclencheur |
|---------|----------|-------------|
| `Code-Tracker.gs` | `trackAllPackages()` | Trigger horaire 1h |
| `Code-Tracker.gs` | `doGet(e)` | Webhook bouton 🔄 APK |
| `Code-Tracker.gs` | `setup()` | Manuel (une fois) |
| `Code-Notif.gs` | `sendStatusNotification(pkg, status)` | Appelé par Code-Tracker |
| `Code-Notif.gs` | `testNotification()` | Manuel (test) |
| `Code-Import.gs` | `importGmailColis()` | Manuel (une fois) |
| `ScriptGoogleGMAIL-v2.gs` | `syncGmailToFirebase()` | Trigger horaire |

**Config Properties Apps Script** :
- `FB_API_KEY` → clé API Firebase (stockée via `setup()`)

**Webhook URL** (à configurer dans locker-tracker Config → Tracking) :
`https://script.google.com/macros/s/AKfycbxAcfNXLfRyXjpZMlwvgjcsjvVKReR-9NNu5pnomHmmk8lsLMGrHzkhtY9vWNtfa2mH4w/exec`

---

**Fin du journal. Dernière modification : 11 juillet 2026**
