# Journal de Projet — FamilyHub v2

**Dernière mise à jour** : 08 juillet 2026  
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
| `lt_links` | Liens de suivi custom par transporteur |
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

**Note (04/07/2026)** : `Code-Tracker.gs` ne lit ni n'écrit jamais `trackingLink` — il consomme uniquement `trackingNum` pour reconstruire l'URL de scraping via `_buildTrackingUrl()`. Aucun changement requis sur ce fichier lors du patch d'homogénéisation des liens.

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

**État actuel** :
- ✅ APK buildé avec plugin natif
- ✅ Permission notification accordée sur le téléphone
- ⏳ Token FCM pas encore dans Firestore (cause: apiKey manquante après réinstall)
- **Action requise** : configurer Firebase dans l'app → fermer/rouvrir → `testNotification()` dans Apps Script

---

## 🔧 Patch 04/07/2026 — Homogénéisation liens de suivi + réorg tabs locker-tracker

### Fix `Code-Import.gs`
- `_isStableTrackingLink(url)` : nouveau helper, teste le hostname contre `IMPORT_STABLE_LINK_HOSTS`.
- `trackingLink` assigné = `rawLink` **si et seulement si** stable ; sinon vide (fallback côté client).
- Déduplication : propage `trackingLink` d'un doublon si l'entrée gardée n'en a pas encore.
- `gmailLink` corrigé : `https://mail.google.com/mail/u/0/?ui=2#inbox/{gmailMsgId}`.

### Fix `locker-tracker/index.html`
- `buildTrackingUrl(carrier, num)` : respecte un lien custom éventuel (`LINKS_KEY = 'lt_links'`).

### Réorganisation des onglets (sheet `shSync`)
5 onglets : BDD / SMS / **Transporteur** (nouveau) / **Config** (recentré) / Logs.

### Non modifié
`Code-Tracker.gs` : ne lit/écrit jamais `trackingLink`, confirmé après relecture complète du fichier.

---

## 🔧 Patch 08/07/2026 — Fix carte colis (clic croisé), import DPD 18 chiffres, faux statut Mondial Relay, requête Gmail incomplète

**Fichiers modifiés** : `locker-tracker/index.html`, `src/Code-Import.gs`, `src/ScriptGoogleGMAIL-v2.gs`.

### Bug 1 — Clic sur une carte colis ouvre/ferme la mauvaise carte (1ère de la liste)

**Cause racine** : `render()` utilisait `p.id` comme identifiant DOM (`id="pc"+p.id`, `data-id`). Pour tout colis importé via Gmail, `id` est une **chaîne** (`gmail_xxx`). Dans `syncFB()` et `FBSync.subscribe()`, la ligne `p.id=Math.round(Number(p.id))` convertissait cette chaîne en `NaN` — **tous** les colis Gmail se retrouvaient avec le même id DOM `id="pcNaN"`/`id="pbNaN"` (dupliqué, invalide). `getElementById('pbNaN')` renvoyait alors systématiquement le **premier** élément portant cet id, quel que soit le colis cliqué.

**Fix** :
- Nouvelle fonction `pkgKey(p){return String(p._fbId||p.id||'');}` — identité unique par colis (SMS/manuel ont aussi un `_fbId` propre : `sms_xxx`, `man_xxx`).
- `render()`, `tog()`, `markDone()`, `delPkg()`, `copyAll()`, `shareP()`, `showQR()` : identité DOM + recherche dans `D.packages` basées sur `pkgKey()`, plus jamais sur `p.id` brut.
- Suppression du cast `Math.round(Number(p.id))` dans `syncFB()` et `FBSync.subscribe()` (source du NaN).

Confiance : **95%**.

### Bug 2 — Colis DPD "FRANKLIN" invisible malgré email + SMS + réimport complet

**Cause email** (`Code-Import.gs` + `ScriptGoogleGMAIL-v2.gs`) : n° de suivi réel = 18 chiffres (`250076115298177488`), regex DPD limitée à exactement 14 (`\d{14}`) → aucun identifiant extrait → email rejeté.
**Fix** : `dpd:[/\b(\d{14,18})\b/]` dans les deux scripts.

**Cause SMS** (`locker-tracker`, `xT()`/`xL()`) : le SMS ne contient ni n° de suivi ni code, seulement un lien court `my.dpd.fr/749wwmfc` **sans** `https://`. `xL()` exigeait le protocole → rien capturé ; `xT()` n'avait aucun fallback shortlink → SMS rejeté.
**Fix** : `xT()` ajoute `/my\.dpd\.fr\/(\w{5,15})/i` (token du lien = pseudo-identifiant) ; `xL()` rend `https://` optionnel devant `my.dpd.fr/`.

⚠️ **Effet de bord** : colis email (n° 18 chiffres) et colis SMS (token shortlink) ne partagent aucun identifiant → 2 entrées distinctes pour le même colis physique. Fusion automatique non implémentée (nécessiterait un matching approximatif expéditeur+date).

Confiance : **90%** (email) / **80%** (SMS).

### Bug 3 — Statut "À retirer" affiché à tort pour un colis Mondial Relay encore en transit

**Cause** (`Code-Import.gs` `_xStatus()`) : le pattern "ready" incluait le mot-clé générique `relais`, qui matche tout email mentionnant "Livraison en Point Relais" — y compris une simple **confirmation de commande** sans aucune info de statut réelle. Effet : statut forcé à `ready` alors que le vrai statut (page Mondial Relay officielle) est "Colis pris en charge" (transit).

**Fix** : retrait de `|relais` du pattern ready (les mots-clés disponible/à retirer/en attente de retrait/consigne suffisent, sans faux positif).

⚠️ Nécessite un nouveau `importGmailColis()` pour corriger le doc déjà en base (`_importWriteFirestore()` ne rétrograde jamais un statut déjà plus avancé) — repurger ou corriger le champ `status` manuellement si besoin.

Confiance : **90%**.

### Bug 4 — Ce colis Mondial Relay remonte via Code-Import.gs mais pas via ScriptGoogleGMAIL-v2.gs

**Cause** : sujet = "Suivi de votre commande - EAFSFBMAQ". La requête Gmail de `ScriptGoogleGMAIL-v2.gs` ne contenait pas "suivi" dans sa liste de mots-clés sujet (contrairement à `Code-Import.gs`) → email jamais recherché par ce script.

**Fix** : requête alignée sur `Code-Import.gs` — ajout de `suivi`, `expédié`, `retrait`, `livré`.

Confiance : **95%**.

### Note opérationnelle (non corrigée, hors scope)
`syncGmailToFirebase()` utilise `LAST_SYNC_TIMESTAMP` (Apps Script Properties), **non réinitialisé** par une purge Firestore. Un ré-exécution manuelle après purge peut ignorer des emails antérieurs au dernier checkpoint. Pour un test propre : `PropertiesService.getScriptProperties().deleteProperty('LAST_SYNC_TIMESTAMP')` avant de relancer.

---

## 🔑 Règles techniques critiques

| Règle | Détail |
|-------|--------|
| `node --check` | Obligatoire après tout patch regex sur un `<script>` |
| Reflow Capacitor | `void el.offsetHeight` après changement style/classList sur overlay |
| Event delegation | `data-action` + `findAction()`, jamais `onclick=` inline |
| TextNode guard | `el.nodeType===1` avant tout `getAttribute` dans `findAction()` |
| Firebase IDs | Toujours `String(id)`, jamais `Number()` / `Math.round()` |
| **Identité DOM colis** | **(08/07)** Toujours `pkgKey(p)=String(p._fbId\|\|p.id)`, jamais `p.id` brut — les id Gmail sont des chaînes ; `Math.round(Number(id))` produit `NaN` et fait collisionner tous les DOM id entre eux |
| Champs Firestore | Toujours `toFields()` avec encodage explicite booléens |
| Champs internes | Exclure les champs `_`-préfixés des payloads Firestore |
| Scripts externes | Jamais en `<head>` sans `defer`. Inliner les modules critiques |
| Secrets GitHub | Jamais de clé API en clair dans le repo (base64 → Secret) |
| Write queue | Toutes écritures Firebase via `FBSync.write()` pour retry auto |
| Apps Script timeout | Max 10 items/run, skip si récent (`SKIP_IF_UPDATED_WITHIN`) |
| FCM token | Cache localStorage si Firebase pas encore configuré → flush au saveFB |
| Liens de suivi | Ne jamais stocker un `trackingLink` tokenisé court-terme en dur — filtrer par `isStableLink()`/`_isStableTrackingLink()` avant assignation |
| **Détection statut email** | **(08/07)** Éviter les mots-clés génériques (ex. "relais") qui matchent le nom du mode de livraison plutôt qu'un vrai événement de statut → faux positifs sur confirmations de commande |
| **Cohérence multi-scripts** | **(08/07)** `Code-Import.gs` et `ScriptGoogleGMAIL-v2.gs` doivent couvrir le même périmètre de mots-clés sujet Gmail, sous peine de divergence silencieuse (un colis visible dans un seul des deux imports) |

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
| `Code-Import.gs` | `importGmailColis()` | Manuel (une fois / après ce patch pour corriger statuts) |
| `ScriptGoogleGMAIL-v2.gs` | `syncGmailToFirebase()` | Trigger horaire |

**Config Properties Apps Script** :
- `FB_API_KEY` → clé API Firebase (stockée via `setup()`)

**Webhook URL** (à configurer dans locker-tracker Transporteur → Tracking) :
`https://script.google.com/macros/s/AKfycbxAcfNXLfRyXjpZMlwvgjcsjvVKReR-9NNu5pnomHmmk8lsLMGrHzkhtY9vWNtfa2mH4w/exec`

---

**Fin du journal. Dernière modification : 08 juillet 2026**
