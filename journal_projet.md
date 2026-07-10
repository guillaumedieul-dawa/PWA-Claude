# Journal de Projet — FamilyHub v2

**Dernière mise à jour** : 09 juillet 2026  
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
| `lt_links` | **Nouveau (04/07)** — Liens de suivi custom par transporteur |
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
- Déploié en Web App → URL webhook configurée dans locker-tracker (Transporteur, ex-Config)

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

### Décision de conception

Un lien capté dans un email peut être :
- **stable** (domaine officiel transporteur, ex: `laposte.fr/outils/suivre-vos-envois`) → safe à propager tel quel
- **tokenisé court-terme** (sous-domaine SMS-style type `n.pkup.fr`, `sms.laposte.fr`, `p.vintedgo.com`) → expire après quelques jours, casse silencieusement si stocké en dur

Filtre retenu : liste de hosts stables dérivée **directement** des domaines déjà en dur dans `buildTrackingUrl()` (locker-tracker) / `_buildTrackingUrl()` (Code-Tracker.gs) — zéro invention, cohérence garantie avec le fallback existant.

```
Hosts stables : chronopost.fr, laposte.fr, mondialrelay.fr, dpd.fr,
                 ups.com, gls-group.com, relaiscolis.com, track.amazon.fr
Hosts rejetés (implicite) : tout sous-domaine hors liste
                 (n.pkup.fr, sms.laposte.fr, p.vintedgo.com, my.dpd.fr,
                  moncolis.gls-france.com, amzn.eu, ups.com/su/...)
```

### Fix `Code-Import.gs`

- `_isStableTrackingLink(url)` : nouveau helper, teste le hostname contre `IMPORT_STABLE_LINK_HOSTS`.
- `_parseEmail()` : `trackingLink` désormais assigné = `rawLink` **si et seulement si** stable ; sinon vide (fallback géré côté client).
- `importGmailColis()` : lors de la déduplication locale (`seen[key]`), propage aussi `trackingLink` d'un doublon si l'entrée gardée n'en a pas encore.
- `_importWriteFirestore()` : si un doc existant est skip (statut déjà à jour ou plus avancé) mais n'a pas de `trackingLink` et que le pkg courant en apporte un stable, complète ce champ isolément via `_importPatchSingleField()` (patch d'un seul champ, respecte `updateMask`, ne perturbe pas le reste du doc).
- `gmailLink` corrigé : `https://mail.google.com/mail/u/0/?ui=2#inbox/{gmailMsgId}` (cohérence avec `ScriptGoogleGMAIL-v2.gs`, était déjà signalé comme fix antérieur mais absent de ce fichier).

### Fix `locker-tracker/index.html`

- `STABLE_LINK_HOSTS` + `isStableLink(url)` : même liste de hosts que côté Apps Script.
- `resolveTrackingLink(p)` : nouvelle fonction centrale de résolution du lien affiché. Priorité : `trackingLink` importé **si stable** → lien custom transporteur (`getCustomLinks()`) → URL générique reconstruite par numéro. S'applique à la lecture, donc corrige rétroactivement l'affichage des documents déjà en base avant ce patch (pas seulement les futurs imports).
- `buildTrackingUrl(carrier, num)` : respecte désormais un lien custom éventuel (`LINKS_KEY = 'lt_links'`, localStorage `{carrier: "https://..."}`) ; gabarit avec placeholder `{num}` ou concaténation en fin d'URL si absent.
- Tous les points de consommation (`_tLink` dans `render()`, `copyAll()`, `shareP()`) unifiés sur `resolveTrackingLink(p)` — plus de logique de fallback dupliquée à 3 endroits différents.

### Réorganisation des onglets (sheet `shSync`)

Avant : 4 onglets — BDD / SMS / Config (tout-en-un) / Logs.
Après : **5 onglets** — BDD / SMS / **Transporteur** (nouveau) / **Config** (recentré) / Logs.

| Onglet | Contenu |
|--------|---------|
| **BDD** (`tSy`) | Statut connexion Firebase, bouton actualiser. Bloc "Configuration Firebase" (inputs projectId/apiKey) **supprimé** — doublon avec `/parametres/index.html`, remplacé par un lien direct vers ce module. |
| **SMS** (`tSM`) | Inchangé — lecture SMS device + collage manuel. |
| **Transporteur** (`tTr`, nouveau) | Délais expiration par transporteur, **liens de suivi personnalisés** (nouveau — `renderLinkCf()` / `saveLinks()`), purge automatique, URL webhook tracking (`forceTrack()`/`saveTrackerWh()`), désactivation par transporteur (déplacé depuis l'ancien `tCf`). |
| **Config** (`tCf`, recentré) | Panel debug + bouton réinitialisation données. Plus rien d'autre (avant : partagé avec tous les réglages transporteur). |
| **Logs** (`tLg`) | Inchangé. |

`forceTrack()` (bouton 🔄 tbar) reste fonctionnellement inchangé, mais son message d'erreur pointe désormais vers "Transporteur → Tracking" au lieu de "Config → Tracking".

### Non modifié

`Code-Tracker.gs` : ne lit/écrit jamais `trackingLink`, aucune raison de le toucher pour cette cohérence — confirmé après relecture complète du fichier.

---

## 🔧 Patch 09/07/2026 — Fix collision ID cartes colis (getElementById doublons)

### Bug rapporté

Clic sur les colis Colissimo/Chronofresh (tous sauf le 1er Mondial Relay, Amazon, et les 2 derniers Chronopost avec codes) ouvrait systématiquement le détail du colis **Amazon** au lieu du leur.

### Root cause

Dans `syncFB()` et le callback `FBSync.subscribe('colis', …)`, l'attribution d'ID pour un colis distant nouvellement vu :

```js
if(!p.id)p.id=D.nextId++;else p.id=Math.round(Number(p.id));
```

Les colis importés Gmail (`Code-Import.gs` : `id: 'gmail_'+msgId` ; `ScriptGoogleGMAIL-v2.gs` : `id: msgId` brut hexadécimal) stockent un champ Firestore `id` non-numérique. `Number("gmail_195abc…")` → `NaN` → `Math.round(NaN)` → `NaN`. **Tous** ces colis récupéraient donc le même `p.id = NaN`, donc le même DOM id `pcNaN`/`pbNaN` en rendu (`render()`). `getElementById` renvoie toujours le **premier** match dans le DOM → le premier colis NaN affiché (Amazon, trié en premier car date la plus ancienne parmi le groupe "Récupéré") captait tous les clics des autres colis NaN.

Root cause identique au bug déjà repéré « Tout copier ne copie rien » (et `markDone`/`delPkg`/`shareP`/`showQR` silencieusement inopérants sur tout colis à `id` numérique) : `D.packages.find(x=>x.id===id)` compare un `p.id` **number** (ou `NaN`) à un `dataset.id` **string** — toujours `false` en égalité stricte JS.

### Fix — `locker-tracker/index.html` uniquement

Nouvelle fonction `pkgKey(p)` : identité stable = `_fbId` (toujours présent — c'est l'ID du document Firestore — et toujours unique), fallback `String(p.id)`.

- `render()` : tous les `id`/`data-id` liés à une carte colis (`pc`/`pb`, `tog`, `showQR`, `shareP`, `copyAll`, `markDone`, `delPkg`) utilisent désormais `pkgKey(p)` au lieu de `p.id`.
- `markDone()`, `delPkg()`, `copyAll()`, `shareP()`, `showQR()` : lookup `pkgKey(x)===id` au lieu de `x.id===id`.
- `syncFB()` + `FBSync.subscribe` : `p.id` n'est plus jamais forcé via `Math.round(Number(...))` (source du `NaN`) — assigné uniquement si absent ou déjà invalide (`typeof p.id!=='number'||isNaN(p.id)` → `D.nextId++`), donc toujours un entier local propre même en fallback.

**Validation** : `node --check` OK sur les 3 blocs `<script>` inline. Vérification grep post-patch : 0 résidu `x.id===id`, 0 résidu `Math.round(Number(p.id))`, 8 usages `pkgKey(`.

**Non modifié** : `Code-Tracker.gs`, `Code-Import.gs`, `ScriptGoogleGMAIL-v2.gs` — bug 100% côté client (attribution locale de `p.id` lors de la première synchronisation d'un doc distant), aucun changement nécessaire côté Apps Script pour ce fix précis.

**Toujours en attente** (hors-sujet de ce rapport, non traité ici) : `FIREBASE_PROJECT` vs `FIREBASE_PROJECT_ID` dans `ScriptGoogleGMAIL-v2.gs::getConfig()` — logs Gmail admin potentiellement invisibles ; log écrit uniquement si `newCount>0`.

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
| **Liens de suivi** | **(04/07)** Ne jamais stocker un `trackingLink` tokenisé court-terme en dur — filtrer par `isStableLink()`/`_isStableTrackingLink()` avant assignation. Résolution d'affichage toujours via `resolveTrackingLink()`, jamais de fallback ad hoc dupliqué. |
| **Identité colis (DOM)** | **(09/07)** Ne jamais utiliser `p.id` brut pour l'identité DOM/lookup d'un colis Firestore — toujours `pkgKey(p)` (= `_fbId`, fallback `String(p.id)`). `p.id` n'est qu'un compteur local interne, jamais garanti unique/non-`NaN` pour des docs importés (Gmail `msgId` non-numérique). |

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

**Webhook URL** (à configurer dans locker-tracker Transporteur → Tracking) :
`https://script.google.com/macros/s/AKfycbxAcfNXLfRyXjpZMlwvgjcsjvVKReR-9NNu5pnomHmmk8lsLMGrHzkhtY9vWNtfa2mH4w/exec`

---

**Fin du journal. Dernière modification : 09 juillet 2026**
