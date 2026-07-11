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
├── icons/carriers/                ← (nouveau) logos transporteurs optionnels, cf Patch 09/07
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
├── src/Config.gs                  ← Apps Script : config centralisée (FIREBASE_API_KEY/PROJECT_ID)
├── src/Code-Tracker.gs           ← Apps Script : scraping transporteurs
├── src/Code-Notif.gs             ← Apps Script : notifications FCM V1
├── src/Code-Import.gs            ← Apps Script : import emails Gmail
├── src/ScriptGoogleGMAIL-v2.gs    ← Apps Script : parsing Gmail (existant)
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
  - `meta/carrierConfig` — config transporteurs (jours/lien perso/actif), synced
  - `meta/appSettings` — **(nouveau 09/07)** purgeDays + trackerWh, synced entre comptes
  - `meta/lastTrackerSync` — log scraping auto
  - `meta/lastGmailImport` — log import Gmail (one-shot)
  - `meta/lastGmailSync` — log sync Gmail récurrent (`ScriptGoogleGMAIL-v2.gs`)

### Clés localStorage

| Clé | Usage |
|-----|-------|
| `lt_v3` | Données colis locales |
| `lt_fb` | Config Firebase (projectId + apiKey) |
| `lt_ret` | Délais expiration par transporteur |
| `lt_logs` | Logs SMS/Firebase/Gmail |
| `lt_disabled` | Transporteurs désactivés |
| `lt_tracker_wh` | URL webhook Code-Tracker.gs (miroir local de `meta/appSettings.trackerWh`) |
| `lt_purge_days` | Délai purge colis (défaut: 20j) (miroir local de `meta/appSettings.purgeDays`) |
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
- `locker-tracker` : suivi colis avec SMS parsing, Firebase sync
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
- Résultat historique : **41 colis importés, 0 erreurs, 96 fils traités en 53 secondes**

Fonction à exécuter : `importGmailColis()`

### Phase 4 — Real-time Sync Firebase [✅ TERMINÉ]

**`fbSync.js`** (externe, chargé via `<script src>`) :
- Polling REST Firestore toutes les **30 secondes** (`fbSubscribe()`) — *(30s depuis Patch 09/07, était 5s)*
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
- Déployé en Web App → URL webhook configurée dans locker-tracker (onglet Transporteurs), **synchronisée Firestore depuis Patch 09/07**

**Bouton 🔄** dans la tbar locker-tracker → force le scraping immédiatement.

**Transporteurs supportés** : Chronopost, Chronofresh, Colissimo, La Poste, Mondial Relay, DPD, UPS, GLS, Relais Colis, Vinted Go, Amazon, Autre.

**⚠️ Bug critique corrigé le 09/07** : `TRACKER_FB_API_KEY` (propriété Apps Script dédiée) est restée à son placeholder d'origine `"REMPLACER_PAR_VOTRE_CLE"` depuis le `setup()` initial — jamais remplacée. Toutes les requêtes Firestore de `trackAllPackages()` échouaient donc silencieusement (clé API invalide). Cf. section Patch 09/07 ci-dessous.

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
- `Code-Notif.gs` : envoi FCM V1, lecture tokens Firestore, templates par statut (déjà sur `_loadGlobalConfig()`, aucune modification requise)
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

*(résumé, cf. commits — non modifié par le patch du 09/07)*

- `Code-Import.gs` : `trackingLink` extrait des emails désormais propagé vers Firestore (filtré par liste de hosts "stables").
- `locker-tracker/index.html` : `resolveTrackingLink(p)` centralise la résolution du lien affiché (trackingLink stable → lien custom transporteur → URL générique reconstruite).
- Réorganisation onglets sheet Administration : BDD / SMS / Transporteur / Config / Logs → consolidé depuis en **BDD / Transporteurs / Logs** (cf. Patch 09/07, les onglets SMS et Config ont été fusionnés dans BDD/Transporteurs entre-temps).

---

## 🔧 Patch 09/07/2026 — Bugs colis + config Apps Script + UI + évolutions

### Bugs corrigés

**1. Bouton "Tout copier" muet.** `copyAll(id)` comparait `D.packages.find(x => x.id === id)` avec `id` = `ds.id`. Or `dataset.id` renvoie **toujours une string**, alors que `p.id` est un **number** (`Math.round`, `D.nextId++`). `===` échouait systématiquement → `find()` retournait `undefined` → sortie silencieuse, rien ne se passait.
**Même bug latent trouvé et corrigé (non signalés mais cause identique) sur `markDone`, `delPkg`, `shareP`.**
Fix : `id = Number(id);` en première ligne de chacune de ces 4 fonctions.

**2. "Dernier sync Gmail (Apps Script)" jamais daté**, alors que le trigger horaire tourne bien. Double cause dans `ScriptGoogleGMAIL-v2.gs` :
- `getConfig()` lisait la propriété `FIREBASE_PROJECT` — **cette propriété n'existe pas** (la vraie s'appelle `FIREBASE_PROJECT_ID`). Résultat : fallback silencieux sur le projet par défaut `'familyhub-colis'`, **sans le suffixe `-8abbd`** — un projet Firestore différent de celui utilisé par toute l'app. C'est très probablement la raison pour laquelle aucune donnée n'apparaissait dans le vrai Firestore pour ce fichier précis.
- Le document `meta/lastGmailSync` n'était réécrit que si `batchWrites.length > 0` (au moins un nouveau colis trouvé). Sur la quasi-totalité des runs (rien de neuf depuis le dernier passage), **aucun log n'était donc jamais écrit**, donnant l'impression trompeuse que le script ne s'exécutait jamais.

Fix : `getConfig()` corrigé (bon nom de propriété + bon projet par défaut) ; log désormais écrit à **chaque** run, y compris à 0 nouveauté (`newCount: 0`).

### Réponses aux questions

**Propriétés Apps Script (Properties du projet) :**

| Propriété | Rôle | Statut après audit |
|---|---|---|
| `FIREBASE_API_KEY` | Clé API Firebase partagée, lue par `Config.gs` (`_loadGlobalConfig()`) | ✅ OK, correcte — c'est la clé "maître" à conserver |
| `FIREBASE_PROJECT_ID` | ID du projet Firestore (`familyhub-colis-8abbd`) | ✅ OK, correcte |
| `LAST_SYNC_TIMESTAMP` | Timestamp en **millisecondes epoch** du dernier `syncGmailToFirebase()` réussi. Sert de borne `after:` pour la requête Gmail (ne relit que les mails plus récents que ce sync). Valeur observée `1783528739021` ≈ **8 juillet 2026, ~16h38 (heure de Paris)** — cohérent avec "hier" par rapport à aujourd'hui, preuve que le script tourne bien. **Ne jamais éditer cette valeur à la main** (un timestamp trop ancien relit inutilement du mail déjà traité ; trop récent risque de sauter des mails). | ✅ OK, fonctionne comme prévu |
| `TRACKER_FB_API_KEY` | Résidu du `setup()` de `Code-Tracker.gs`, jamais remplacée : valeur littérale `"REMPLACER_PAR_VOTRE_CLE"` (placeholder d'origine). | ❌ Cassait silencieusement toutes les requêtes Firestore de `trackAllPackages()` (clé API invalide → 400). **Fixé** aujourd'hui : `Code-Tracker.gs` priorise désormais `FIREBASE_API_KEY` et ignore ce placeholder. **Cette propriété est supprimable** après déploiement du patch (plus lue en priorité, gardée seulement en repli inoffensif). |

**Bouton QR (détail colis) — comment il fonctionnait :** générait un QR **fabriqué côté client** (librairie JS `qrcodejs`) encodant le **texte brut** du code retrait ou du numéro de suivi. Ce n'était **jamais** le QR officiel émis par le transporteur (qui embarque des données signées/propriétaires propres à chaque casier). Un tel QR auto-généré n'est pas reconnu par les scanners de consigne/locker physiques.
→ **Supprimé** conformément à la demande : bouton, sheet `#shQR`, fonction `showQR()`, librairie externe `qrcode.min.js`.

### Évolutions livrées

1. **Logos transporteurs** : `carrierLogo()` réécrit. Chaque badge tente de charger `../icons/carriers/{carrier}.png` ; en cas d'échec (404, aucun fichier fourni pour l'instant — question de droits de marque, pas de blocage technique), bascule automatiquement (`onerror`) sur un badge texte 2-3 lettres coloré (`CBADGE`, ex. `UPS`, `DPD`, `MR`…). **Pour activer les vrais logos** : déposer des PNG carrés dans `icons/carriers/` avec le nom exact de la clé transporteur (`chronopost.png`, `colissimo.png`, `mondialrelay.png`, `dpd.png`, `ups.png`, `gls.png`, `relaiscolis.png`, `vintedgo.png`, `laposte.png`, `amazon.png`, `chronofresh.png`, `other.png`) — aucun changement de code nécessaire, le fallback bascule automatiquement dès que le fichier existe.
2. **`POLL_MS` 5s → 30s** dans `fbSync.js` (réduit la charge réseau/batterie ; le scraping horaire + les writes explicites restent immédiats côté écriture, seul le polling de lecture est ralenti).
3. **Purge auto synchronisée entre comptes** : nouveau doc Firestore `meta/appSettings` (champ `purgeDays`), écrit par `savePurgeDays()`, relu au démarrage de l'app (`initAppSettings()`).
4. **URL webhook tracker synchronisée entre comptes** : même doc `meta/appSettings` (champ `trackerWh`), écrit par `saveTrackerWh()`, relu au démarrage. **Sécurité** : pas de surface d'attaque nouvelle — la clé API Firebase est déjà, dans l'architecture actuelle, le point d'accès unique à l'ensemble des données de l'app (pas de couche Auth utilisateur) ; stocker cette URL à côté n'élargit rien pour quelqu'un qui n'a pas déjà cette clé.
5. **"Réinitialiser toutes les données"** (`resetAll()`) : supprime désormais aussi tous les documents Firestore de la collection `colis` (récupérés via `fbAll()`, supprimés via `fbDel()`), en plus du localStorage local. Portée volontairement limitée à `colis` (pas `carrierConfig`/`appSettings`/logs).
6. **Header illisible ("À retirer" sur 2 lignes)** : le compteur était concaténé dans le titre `.th` (Bebas Neue 26px), provoquant un retour à la ligne sur écrans étroits. Déplacé en **pastille compacte** (`#totalBadge.cnt-pill`) séparée, visible uniquement s'il y a des colis à retirer (masquée sinon, comme un badge de notification).

**Fichiers modifiés** : `locker-tracker/index.html`, `fbSync.js`, `src/Code-Tracker.gs`, `src/Code-Import.gs`, `src/ScriptGoogleGMAIL-v2.gs`, `journal_projet.md`.

**Non modifiés (vérifiés, pas de bug trouvé)** : `src/Config.gs` (déjà correct — sert désormais de référence pour les 3 autres fichiers), `src/Code-Notif.gs` (utilise déjà `_loadGlobalConfig()`).

**Note ménage** : `DATA-IMPORT-EMAILS.md` documente une phase (3.5) terminée depuis longtemps — obsolète, supprimable manuellement du repo (le tool de déploiement ZIP n'efface pas les fichiers absents du ZIP, suppression à faire côté GitHub directement si souhaité).

---

## 🔧 Patch 11/07/2026 — Correction régression (stale baseline) + fix ID définitif

### Incident : régression par baseline obsolète

Entre la session du 09/07 ci-dessus et celle-ci, une conversation Claude **séparée** (autre thread, même projet) a traité un bug distinct (« clic sur un colis Colissimo ouvre le détail d'Amazon »). Cette conversation ne disposait **pas** de cet artefact — elle s'appuyait sur les fichiers projet attachés à ce thread-là, restés sur un **instantané antérieur** au 09/07 (logos emoji uniquement, pas de sync Firestore `meta/appSettings`, `POLL_MS=5000`, pas de fix `Number(id)`). Le correctif produit dans cette conversation était **techniquement correct pour le symptôme traité**, mais livré sur cette base ancienne → régression de tous les acquis du 09/07 lors du push GitHub (logos redevenus emoji, purge/webhook plus synchronisés Firestore, etc.).

**Leçon (déjà actée en règle générale, reconfirmée ici)** : sans upload explicite de l'artefact ZIP le plus récent dans une conversation, Claude ne peut pas savoir qu'une base plus avancée existe ailleurs. → Toujours fournir le dernier ZIP généré en pièce jointe avant de demander un nouveau correctif, même pour un fichier « déjà connu ».

### Root cause du bug d'origine (rappel)

`syncFB()` / `FBSync.subscribe()` : pour un colis distant jamais vu localement, `p.id` était forcé via `Math.round(Number(p.id))`. Les colis importés Gmail stockent un `id` Firestore non-numérique (`gmail_<msgId>` ou `msgId` hex brut) → `Number(...)` → `NaN` → **tous** ces colis partagent le même `p.id = NaN`, donc le même DOM id `pcNaN`/`pbNaN`. `getElementById` renvoie toujours le premier match → clic sur n'importe lequel de ces colis ouvre celui rendu en premier (Amazon, trié en tête du groupe « Récupéré » par date).

Le correctif du 09/07 matin (`id = Number(id)` en tête de `markDone`/`delPkg`/`copyAll`/`shareP`) réglait le symptôme « Tout copier muet » pour les colis à `id` numérique valide, mais **pas** la collision `NaN` elle-même : `Number("NaN")` reste `NaN`, et `NaN === NaN` est `false` en JS — ces 4 boutons restaient silencieusement inopérants sur tout colis Gmail touché par la collision.

### Fix définitif (remplace `id=Number(id)`) — `locker-tracker/index.html` uniquement

Nouvelle fonction `pkgKey(p)` : identité stable = `_fbId` (ID du document Firestore, toujours présent, toujours unique), fallback `String(p.id)`.

- `render()` : `id`/`data-id` des cartes (`pc`/`pb`, `tog`, `shareP`, `copyAll`, `markDone`, `delPkg`) → `pkgKey(p)` au lieu de `p.id`.
- `markDone()`, `delPkg()`, `copyAll()`, `shareP()` : suppression de la ligne `id=Number(id)` ; lookup `pkgKey(x)===id` (et `pkgKey(x)!==id` pour le `filter` de `delPkg`) au lieu de `x.id===id`.
- `syncFB()` + `FBSync.subscribe` : `p.id` n'est plus jamais forcé via `Math.round(Number(...))` — assigné uniquement si absent ou déjà invalide (`typeof p.id!=='number'||isNaN(p.id)` → `D.nextId++`).

**Validation** : diff isolé au strict nécessaire (10 blocs modifiés, vérifié par `diff -u` contre cet artefact) — aucune régression sur les acquis du 09/07 (logos `<img>`, `meta/appSettings`, `POLL_MS=30000`, badge `cnt-pill`, suppression QR, `resetAll()` Firebase). `node --check` OK sur les 3 blocs `<script>` inline. Grep post-patch : 0 résidu `x.id===id` / `x.id!==id` / `id=Number(id)` / `Math.round(Number(p.id))`.

**Fichiers modifiés** : `locker-tracker/index.html`, `journal_projet.md` uniquement. `fbSync.js` et les `.gs` non re-livrés (non impactés par la régression — celle-ci ne portait que sur le fichier régénéré depuis la base obsolète).

---

## 🔑 Règles techniques critiques

| Règle | Détail |
|-------|--------|
| `node --check` | Obligatoire après tout patch regex sur un `<script>` (copier les `.gs` en `.js` pour les vérifier, node refuse l'extension `.gs`) |
| Reflow Capacitor | `void el.offsetHeight` après changement style/classList sur overlay |
| Event delegation | `data-action` + `findAction()`, jamais `onclick=` inline |
| TextNode guard | `el.nodeType===1` avant tout `getAttribute` dans `findAction()` |
| Firebase IDs (`_fbId`) | Toujours `String(id)`, jamais `Number()` / `Math.round()` |
| **Identité colis (DOM + lookup)** | **(11/07, définitif — remplace la règle `Number(ds.id)` du 09/07 matin, insuffisante)** Ne jamais utiliser `p.id` brut (number, parfois `NaN` sur import Gmail) pour l'identité DOM ou un lookup `D.packages.find()`. Toujours `pkgKey(p)` = `String(p._fbId)` (fallback `String(p.id)`) — `_fbId` est l'ID du document Firestore, garanti unique et jamais `NaN`. `Number(ds.id)` masquait le symptôme « Tout copier muet » pour les colis à ID numérique mais ne résolvait pas la collision `getElementById` sur les colis Gmail (`id` string type `gmail_xxx` → `Number()` → `NaN` → tous ces colis partagent le même DOM id, un clic ouvre toujours le premier). |
| Champs Firestore | Toujours `toFields()` avec encodage explicite booléens |
| Champs internes | Exclure les champs `_`-préfixés des payloads Firestore |
| Scripts externes | Jamais en `<head>` sans `defer`. Inliner les modules critiques |
| Secrets GitHub | Jamais de clé API en clair dans le repo (base64 → Secret) |
| Write queue | Toutes écritures Firebase via `FBSync.write()` pour retry auto |
| Apps Script timeout | Max 10 items/run, skip si récent (`SKIP_IF_UPDATED_WITHIN`) |
| FCM token | Cache localStorage si Firebase pas encore configuré → flush au saveFB |
| Liens de suivi | Ne jamais stocker un `trackingLink` tokenisé court-terme en dur — filtrer par `isStableLink()`/`_isStableTrackingLink()` avant assignation |
| **Config Apps Script** | **(09/07)** Toujours résoudre `FIREBASE_API_KEY` / `FIREBASE_PROJECT_ID` en priorité dans chaque `.gs` (propriétés réellement renseignées) ; ne jamais dupliquer une logique de lecture de propriété différente par fichier — source de bugs de config divergente silencieux (cf. `TRACKER_FB_API_KEY` placeholder, `FIREBASE_PROJECT` mal orthographié) |

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
| Phase 4 | ✅ | Real-time sync polling (30s depuis 09/07) |
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
| `Code-Tracker.gs` | `setup()` | Manuel (une fois, legacy — clé prioritaire désormais `FIREBASE_API_KEY`) |
| `Code-Notif.gs` | `sendStatusNotification(pkg, status)` | Appelé par Code-Tracker |
| `Code-Notif.gs` | `testNotification()` | Manuel (test) |
| `Code-Import.gs` | `importGmailColis()` | Manuel (une fois) |
| `ScriptGoogleGMAIL-v2.gs` | `syncGmailToFirebase()` | Trigger horaire |

**Config Properties Apps Script (état au 09/07/2026)** :
- `FIREBASE_API_KEY` → clé API Firebase (source de vérité, utilisée par tous les fichiers `.gs`)
- `FIREBASE_PROJECT_ID` → `familyhub-colis-8abbd` (source de vérité)
- `LAST_SYNC_TIMESTAMP` → géré automatiquement par `syncGmailToFirebase()`, ne pas éditer
- `TRACKER_FB_API_KEY` → legacy, non prioritaire depuis le 09/07, supprimable

**Webhook URL** (configurable dans locker-tracker → Administration → Transporteurs, synchronisée Firestore depuis le 09/07) :
`https://script.google.com/macros/s/AKfycbxAcfNXLfRyXjpZMlwvgjcsjvVKReR-9NNu5pnomHmmk8lsLMGrHzkhtY9vWNtfa2mH4w/exec`

---

**Fin du journal. Dernière modification : 11 juillet 2026**
