# Journal de Projet APK - Base de Connaissances Centralisée

**Dernière mise à jour** : 06 juin 2026  
**Créé le** : 23 mai 2026

---

## 📋 Résumé Exécutif

Source unique de vérité (SSOT) pour FamilyHub v2 — APK Android distribué via Capacitor v8 + GitHub Actions.

**Stack** : Native HTML/CSS/JS · Firestore REST · localStorage cache/offline · Capacitor v8  
**Utilisateurs** : Guillaume + Michèle · Firebase project: `familyhub-colis-8abbd`  
**Repo** : https://github.com/guillaumedieul-dawa/PWA-Claude  
**Développement** : Téléphone portable exclusif

---

## 🏗️ Architecture

```
repo-github/
├── index.html                    ← Hub principal
├── themes.css                    ← Système 3 thèmes (light/dark/sepia)
├── theme.js                      ← IIFE init thème + sélecteur pastilles
├── fbSync.js                     ← Phase 4: polling + write queue
├── firebaseSync.js               ← Bibliothèque Firebase centralisée
├── sw.js                         ← Service Worker v6
├── manifest.json
├── locker-tracker/index.html     ← Suivi colis (module principal)
├── todo-partage/index.html
├── liste-courses/index.html
├── cave-spiritueux/index.html
└── menus-semaine/index.html
```

**UI** : Cream & Ink — fond ivoire `#faf7f2`, Bebas Neue titres, Plus Jakarta Sans body  
**Thèmes** : light / dark / sepia — clé localStorage `fh_theme`

---

## ✅ Phases Complétées

### Phase 1 — Bootstrap
Structure repo, 5 modules, Service Worker, manifest, Capacitor config.

### Phase 2 — Fonctionnalités
Modules complets : locker-tracker (SMS + Firebase), todo-partage, liste-courses, cave-spiritueux, menus-semaine.

### Phase 3 — APK Refactor Android WebView ✅ (juin 2026)

**21 bugs identifiés et corrigés :**

| Bug | Correction |
|-----|------------|
| `onclick=` inline → crash Capacitor | Migration vers `data-action` dispatcher global |
| `e.target.closest()` crash TextNode | `findAction()` avec guard `nodeType===1` |
| `classList` sans reflow | `void el.offsetHeight` dans `openSheet()` |
| `openSync()` dupliqué | Dédoublonné, une seule définition |
| String IDs Firebase castés en Number | `String(id)` direct dans `tog()` |
| Purge date logic inversée | `arrivalDate\|\|lastUpdated` (pas l'inverse) |
| Badge count filtre divergence | Refonte `updBadges()` centralisée |

**Fichiers livrés Phase 3 :**
- `locker-tracker/index.html` — `project_20260605_214100.zip`
- `todo-partage/index.html` + `liste-courses/index.html` + `cave-spiritueux/index.html` — `project_20260606_fixes_modules.zip`
- `menus-semaine/index.html` — déjà conforme

**Tests device Android** : ✅ validés (overlay sheets, thème, filtres, rendering)

### Phase 4 — Real-time Sync ✅ (juin 2026)

**`fbSync.js`** — module dédié (ne pas dupliquer dans chaque HTML) :
- `FBSync.subscribe(collection, onData)` : polling Firestore REST toutes les 5s
- `FBSync.write(coll, id, data)` : write avec retry exponentiel (1s→2s→4s→…→30s max)
- `FBSync.delete(coll, id)` : delete avec retry exponentiel
- Write queue persistée en localStorage (`fb_wq`) — survit aux crashes
- Pause polling sur `visibilitychange` (app en arrière-plan)
- `FBSync.ui.setStatus('ok'|'syncing'|'error')` → point `#syncDot` coloré dans header
- Animation `@keyframes fbPulse` pour état syncing

**Intégration locker-tracker :**
- `autoSync()` supprimé → remplacé par `FBSync.subscribe('colis', cb)`
- `fbW()` → `FBSync.write()`
- `fbDel()` → `FBSync.delete()`
- `#syncDot` ajouté dans le bouton sync (tbar)

---

## 🔧 Principes Techniques Clés

| Principe | Détail |
|----------|--------|
| Capacitor WebView reflow | `void el.offsetHeight` après `classList` / `style` change |
| Event delegation | `data-action` attrs + dispatcher global, jamais `onclick=` inline |
| TextNode guard | `el.nodeType===1` avant tout `getAttribute` dans `findAction()` |
| Firebase IDs | Toujours `String(id)`, jamais `Number()` / `Math.round()` |
| Write queue | Toutes les écritures via `FBSync.write()` pour retry auto |
| Polling efficace | `visibilitychange` pause/resume, 5s intervalle |

---

## 📦 Livrables ZIP

| Date | Fichier | Contenu |
|------|---------|---------|
| 2026-06-05 | `project_20260605_214100.zip` | `locker-tracker/index.html` Phase 3 |
| 2026-06-06 | `project_20260606_fixes_modules.zip` | todo + courses + cave Phase 3 |
| 2026-06-06 | `project_20260606_phase4.zip` | `fbSync.js` + `locker-tracker/index.html` Phase 4 |

---

## 🗓️ Roadmap

| Phase | État | Description |
|-------|------|-------------|
| Phase 1 | ✅ | Bootstrap |
| Phase 2 | ✅ | Modules fonctionnels |
| Phase 3 | ✅ | APK Refactor Android WebView |
| Phase 4 | ✅ | Real-time sync polling |
| Phase 3.5 | ⏳ | Data import 60 PDFs Gmail → Firestore |
| Phase 5 | ⏳ | Tracking automatique transporteurs |

---

## 🔐 Secrets

**JAMAIS committer** : clés API, tokens, certificats.  
**Stocker** : variables GitHub Actions secrets, localStorage côté device.

