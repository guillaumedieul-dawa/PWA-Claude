# Journal de Projet — FamilyHub v2

**Dernière mise à jour** : 04 juillet 2026  
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
  - `meta/menus/jours/{dateKey}` — menus semaine
  - `meta/fcmTokens/{account}` — tokens FCM push (Guillaume/Michele)
  - `meta/carrierConfig` — jours de rétention + liens custom + actif/inactif par transporteur
  - `meta/appSettings` — purge (jours) + URL webhook tracker, synchronisés cross-comptes **(nouveau 12/07)**
  - `meta/lastTrackerSync` — log scraping auto
  - `meta/lastGmailImport` — log import historique Gmail (Code-Import.gs, one-shot)
  - `meta/lastGmailSync` — log sync Gmail horaire (ScriptGoogleGMAIL-v2.gs)

### Clés localStorage

| Clé | Usage |
|-----|-------|
| `lt_v3` | Données colis locales |
| `lt_fb` | Config Firebase (projectId + apiKey) |
| `lt_ret` | Délais expiration par transporteur |
| `lt_logs` | Logs SMS/Firebase/Gmail |
| `lt_disabled` | Transporteurs désactivés |
| `lt_tracker_wh` | URL webhook Code-Tracker.gs (miroir local de `meta/appSettings.trackerWebhookUrl`) |
| `lt_purge_days` | Délai purge colis (défaut: 20j) (miroir local de `meta/appSettings.purgeDays`) |
| `lt_trcfg_cache` | Cache local de `meta/carrierConfig` |
| `lt_links` | Liens de suivi custom par transporteur (legacy, cf. patch 04/07) |
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
- Polling REST Firestore toutes les **30 secondes** (`fbSubscribe()`) — **changé de 5s à 30s le 12/07** (réduction conso data/batterie)
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
- Déploié en Web App → URL webhook configurée dans locker-tracker (Transporteur, ex-Config), **synchronisée Firestore depuis le 12/07**

**Bouton 🔄** dans la tbar locker-tracker → force le scraping immédiatement.

**Transporteurs supportés** : Chronopost, Chronofresh, Colissimo, La Poste, Mondial Relay, DPD, UPS, GLS, Relais Colis, Vinted Go, Amazon, Autre.

**Note (04/07/2026)** : `Code-Tracker.gs` ne lit ni n'écrit jamais `trackingLink` — il consomme uniquement `trackingNum` pour reconstruire l'URL de scraping via `_buildTrackingUrl()`. Aucun changement requis sur ce fichier lors du patch d'homogénéisation des liens (cf. section dédiée ci-dessous).

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

## 🔧 Patch 04/07/2026 — Homogénéisation liens de suivi + réorg tabs locker-tracker

### Contexte / bug identifié

`Code-Import.gs` extrayait un `trackingLink` depuis les emails Gmail (`_xLink()`) mais ne le propageait **jamais** dans le document Firestore final (`_parseEmail()` ne l'assignait pas). Conséquence : le lien "Suivre sur..." affiché dans l'app était quasi-systématiquement l'URL générique reconstruite par numéro (`buildTrackingUrl()`), sauf pour les colis ajoutés via SMS (où `trackingLink` était bien alimenté par `xL(body)`). Comportement incohérent entre les deux sources d'import.

### Fix `Code-Import.gs`

- `_isStableTrackingLink(url)` : nouveau helper, teste le hostname contre `IMPORT_STABLE_LINK_HOSTS`.
- `_parseEmail()` : `trackingLink` désormais assigné = `rawLink` **si et seulement si** stable ; sinon vide (fallback géré côté client).
- `importGmailColis()` : lors de la déduplication locale, propage aussi `trackingLink` d'un doublon si l'entrée gardée n'en a pas encore.
- `_importWriteFirestore()` : complète isolément `trackingLink` sur un doc existant qui en manque, via `_importPatchSingleField()`.

### Fix `locker-tracker/index.html`

- `STABLE_LINK_HOSTS` + `isStableLink(url)` : même liste de hosts que côté Apps Script.
- `resolveTrackingLink(p)` : résolution centrale du lien affiché (priorité : `trackingLink` importé si stable → lien custom transporteur → URL générique reconstruite).
- `buildTrackingUrl(carrier, num)` : respecte un lien custom éventuel (`LINKS_KEY = 'lt_links'`).

### Réorganisation des onglets (sheet `shSync`)

5 onglets décrits : BDD / SMS / Transporteur / Config / Logs. *(Note 12/07 : cette description à 5 onglets ne correspond pas à la structure à 3 onglets — BDD/Transporteurs/Logs — présente dans le fichier `locker-tracker/index.html` fourni en base du patch du 12/07 ; écart non résolu, cf. avertissement en tête du patch 12/07.)*

### Non modifié

`Code-Tracker.gs` : ne lit/écrit jamais `trackingLink`, confirmé après relecture complète.

---

## 🔧 Patch 12/07/2026 — Fix copyAll/actions colis, log Gmail, purge/webhook sync, suppression QR, logos transporteurs

> ⚠️ **Avertissement baseline** : ce patch a été construit à partir des fichiers de project knowledge fournis en contexte (pas d'archive ZIP jointe au message). Le fichier `locker-tracker/index.html` de base ne présentait ni `pkgKey()`, ni logos `<img>`, ni sync `meta/appSettings` — pourtant mentionnés comme "déjà faits" dans la mémoire long-terme. Écart non expliqué (régression antérieure probable, ou mémoire en avance sur ce repo). **Avant de builder l'APK : confirmer que ce ZIP correspond bien à l'état réel du repo GitHub (comparer avec `raw.githubusercontent.com`), sinon repartir de la version GitHub actuelle.**

### Bugs corrigés

**1. "Tout copier" (et actions colis en général) sans effet — RÉGRESSION confirmée**
`data-id` portait `p.id` (number, souvent `NaN` pour les imports Gmail : `Math.round(Number("gmail_xxx"))` = `NaN`). `el.dataset.id` renvoie toujours une string → `x.id===id` (number/NaN vs string) ne matchait **jamais**, quel que soit le colis (pas seulement Gmail : même un id numérique "5" ne matche pas la string "5" en `===`). Cassait silencieusement `copyAll`, `shareP`, `markDone`, `delPkg` pour TOUS les colis.
**Fix** : `pkgKey(p)` = `_fbId` (string stable, toujours présente en création) comme clé unique pour `data-id`, IDs DOM (`pc-`/`pb-`) et tous les `D.packages.find()`. `copyAll`/`shareP` incluent désormais aussi le lien reconstruit (`buildTrackingUrl`) quand `trackingLink` est vide, pour cohérence avec l'affichage carte. Durcissement additionnel : `syncFB()` et `FBSync.subscribe()` n'assignent plus `NaN` à `p.id` (fallback compteur local).

**2. Log "Dernier sync Gmail" toujours vide malgré exécutions réelles**
Deux causes cumulées dans `ScriptGoogleGMAIL-v2.gs` :
- `getConfig()` lisait la Property `FIREBASE_PROJECT` (sans `_ID`) — ne correspond à aucune clé utilisée ailleurs dans le projet Apps Script partagé (`Config.gs` utilise `FIREBASE_PROJECT_ID`). Fallback silencieux vers `'familyhub-colis'` (projet inexistant) → écritures perdues.
- Le log `meta/lastGmailSync` n'était écrit QUE si `batchWrites.length>0`. Un run sans nouveau colis (fréquent en horaire) n'écrivait jamais rien.
**Fix** : fallback multi-clés sur `getConfig()` (+ défaut correct `familyhub-colis-8abbd`) + log écrit à chaque exécution, avec ou sans nouveau colis + abort explicite loggé si apiKey absente.
**Action restante non vérifiable depuis ici** : contrôler dans Apps Script → Exécutions que `FIREBASE_API_KEY` (ou `TRACKER_FB_API_KEY`/`FB_API_KEY`) et idéalement `FIREBASE_PROJECT_ID` sont bien définies dans Script Properties.

### Question — Bouton QR

`showQR()` générait un QR **local** (lib `qrcodejs`) encodant le texte brut du code retrait/n° suivi — CE N'EST PAS le QR du mail/site transporteur (souvent un payload structuré/signé propre au transporteur, non reproductible depuis le texte seul). Un locker ne reconnaîtra pas cette régénération. **Fonction supprimée** (bouton, sheet `shQR`, lib `qrcodejs` retirée du `<head>`, fonction `showQR()`).

### Évolutions livrées

| # | Évolution | Détail |
|---|-----------|--------|
| 1 | Logos transporteurs | `carrierLogo()` → `<img src="../icons/carriers/{carrier}.png">` + fallback emoji auto (`onerror`) si PNG absent/échoue. **Action requise Guillaume** : déposer 12 PNG dans `/icons/carriers/` (chronopost, chronofresh, mondialrelay, colissimo, laposte, vintedgo, amazon, dpd, ups, gls, relaiscolis, other — noms en minuscules, sans accent). |
| 2 | Polling Firestore | `fbSync.js` : `POLL_MS` 5000 → 30000 |
| 3 | Purge days sync | `meta/appSettings.purgeDays` (Firestore), lu au chargement (`initAppSettings`) + écrit sur `savePurgeDays()` |
| 4 | Webhook tracker sync | `meta/appSettings.trackerWebhookUrl` (Firestore), lu au chargement + écrit sur `saveTrackerWh()`. Reste éditable/sauvegardable localement (`lt_tracker_wh` conservé comme cache). Risque sécu jugé nul : l'URL est déjà présente en clair sur chaque device, et Firestore est déjà protégé par la même clé API que le reste des données de l'app. |
| 5 | Reset réel Firestore | `resetAll()` (async) supprime désormais tous les documents `colis/*` côté Firestore (fusion liste locale + fetch Firestore frais, `Promise.all(fbDel)`) — avant : reset local uniquement, les colis revenaient au sync suivant |
| 6 | Header illisible | Badge nombre de colis déplacé sur sa propre ligne (`.tcnt`, 12px) — ne partage plus la ligne du titre Bebas Neue 26px, ne wrap plus à côté du bouton Maison |

### Fichiers modifiés
`locker-tracker/index.html` · `fbSync.js` · `src/ScriptGoogleGMAIL-v2.gs`

### Non modifié / vérifié sans impact
`Code-Tracker.gs`, `Code-Notif.gs`, `Code-Import.gs`, `Config.gs` : aucune dépendance sur `p.id`/QR/`POLL_MS`/`meta/appSettings`. Autres modules (`todo-partage`, `liste-courses`, `cave-spiritueux`, `menus-semaine`) : implémentent leur propre REST Firebase inline, ne chargent pas `fbSync.js`, non concernés par ce patch.

---

## 🔑 Règles techniques critiques

| Règle | Détail |
|-------|--------|
| `node --check` | Obligatoire après tout patch regex sur un `<script>` (extraire le bloc inline) ou un `.gs` (copier en `.js` d'abord) |
| Reflow Capacitor | `void el.offsetHeight` après changement style/classList sur overlay |
| Event delegation | `data-action` + `findAction()`, jamais `onclick=` inline |
| TextNode guard | `el.nodeType===1` avant tout `getAttribute` dans `findAction()` |
| **Clé DOM/lookup colis** | **`pkgKey(p)` = `_fbId`** pour `data-id`, IDs DOM (`pc-`/`pb-`) et `D.packages.find()`. Jamais `p.id` seul (`Math.round(Number("gmail_xxx"))` = `NaN`, et même un id numérique ne matche pas la string renvoyée par `dataset`). Régression déjà survenue une fois — vigilance requise à chaque nouvelle fonctionnalité touchant aux cartes colis. |
| Champs Firestore | Toujours `toFields()` avec encodage explicite booléens |
| Champs internes | Exclure les champs `_`-préfixés des payloads Firestore |
| Scripts externes | Jamais en `<head>` sans `defer`. Inliner les modules critiques |
| Secrets GitHub | Jamais de clé API en clair dans le repo (base64 → Secret) |
| Write queue | Toutes écritures Firebase via `FBSync.write()` pour retry auto |
| Apps Script timeout | Max 10 items/run, skip si récent (`SKIP_IF_UPDATED_WITHIN`) |
| FCM token | Cache localStorage si Firebase pas encore configuré → flush au saveFB |
| Liens de suivi | Ne jamais stocker un `trackingLink` tokenisé court-terme en dur — filtrer par `isStableLink()`/`_isStableTrackingLink()`. Résolution toujours via `resolveTrackingLink()`/fallback `buildTrackingUrl()`. |
| **Properties Apps Script partagées** | Un seul jeu de noms canonique à travers tous les `.gs` du projet partagé : `FIREBASE_PROJECT_ID` (pas `FIREBASE_PROJECT`) + `FIREBASE_API_KEY`. Chaque script doit fallback sur les variantes legacy (`TRACKER_FB_API_KEY`, `FB_API_KEY`) mais ne doit **jamais** introduire un nouveau nom de Property sans vérifier les autres fichiers du projet. Cause du bug log Gmail vide le 12/07. |
| **Baseline patch** | Toujours confirmer la source des fichiers avant patch (ZIP joint vs project knowledge) — écart déjà constaté le 12/07 entre mémoire long-terme et fichiers réels. |

---

## 📦 Gestion des livrables

**Format** : fichier ZIP horodaté UTC, arborescence GitHub complète.  
**Déploiement** : `push-familyhub.html` → ZIP drop → push GitHub → trigger GitHub Actions.

**Règle patch** : appliquer sur le fichier GitHub actuel (`curl` depuis `raw.githubusercontent.com`), pas depuis un cache local.

---

## 🚀 Roadmap

| Phase | État | Description |
|-------|------|--------------|
| Phase 1 | ✅ | Bootstrap, repo, GitHub Actions |
| Phase 2 | ✅ | 5 modules fonctionnels |
| Phase 3 | ✅ | APK WebView refactor (21 bugs) |
| Phase 3.5 | ✅ | Import 41 colis Gmail |
| Phase 4 | ✅ | Real-time sync polling (30s depuis 12/07, 5s avant) |
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
| `ScriptGoogleGMAIL-v2.gs` | `syncGmailToFirebase()` | Trigger horaire — log désormais systématique (`meta/lastGmailSync`) |

**Config Properties Apps Script** (nom canonique à privilégier) :
- `FIREBASE_PROJECT_ID` → project ID Firestore
- `FIREBASE_API_KEY` → clé API Firebase
- (legacy toléré en fallback : `FIREBASE_PROJECT`, `TRACKER_FB_API_KEY`, `FB_API_KEY`)

**Webhook URL** (à configurer dans locker-tracker Transporteur → Tracking, synchronisée Firestore depuis le 12/07) :
`https://script.google.com/macros/s/AKfycbxAcfNXLfRyXjpZMlwvgjcsjvVKReR-9NNu5pnomHmmk8lsLMGrHzkhtY9vWNtfa2mH4w/exec`

---

**Fin du journal. Dernière modification : 12 juillet 2026**
