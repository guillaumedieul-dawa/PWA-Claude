# FamilyHub v2 — Corrections Appliquées

**Date de génération** : 01/05/2026 - 11:57 UTC
**Version** : 2.0.0-clean

---

## 📋 Résumé des modifications

### ✅ Fichiers supprimés (nettoyage)
- `storage.js` — jamais importé, contenu invalide (HTML mixé à JS)
- `icons/screenshot-courses-narrow.svg`
- `icons/screenshot-home-narrow.svg`
- `icons/screenshot-home-wide.svg`
- `icons/screenshot-locker-narrow.svg`

**Impact** : -5 fichiers inutiles, réduction légère du poids du repo

---

### 🔧 Fichiers corrigés

#### 1. **cave-spiritueux/manifest.json**
```diff
- "src": "../../icons/home-192.png"
+ "src": "../icons/home-192.png"
```
**Raison** : chemin relatif incorrect (2 niveaux au lieu de 1)

#### 2. **menus-semaine/manifest.json**
```diff
- "src": "../../icons/home-192.png"
+ "src": "../icons/home-192.png"
```
**Raison** : chemin relatif incorrect (2 niveaux au lieu de 1)

#### 3. **todo-partage/manifest.json**
```diff
- "src": "../../icons/home-192.png"
+ "src": "../icons/home-192.png"
```
**Raison** : chemin relatif incorrect (2 niveaux au lieu de 1)

#### 4. **locker-tracker/manifest.json**
- ✓ Suppression du doublon d'icône 512px (déclarée 2 fois)
- ✓ Fusion des purposes "any" + "maskable" en une seule entrée
- ✓ Suppression de la section `screenshots` (fichiers SVG supprimés)

**Avant** :
```json
"icons": [
  { "src": "../icons/locker-512.png", "purpose": "any" },
  { "src": "../icons/locker-512.png", "purpose": "maskable" }
]
```

**Après** :
```json
"icons": [
  { "src": "../icons/locker-512.png", "purpose": "any maskable" }
]
```

---

### ✨ Fichiers créés

#### **liste-courses/manifest.json** (nouveau)
Fichier manquant mais référencé dans `sw.js` STATIC_ASSETS.

```json
{
  "name": "Liste de Courses",
  "short_name": "Courses",
  "description": "Liste partagée de courses — Dieul-Gandet",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#0f1419",
  "theme_color": "#ff6b35",
  "icons": [
    { "src": "../icons/courses-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "../icons/courses-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 📊 Statistiques

| Métrique | Avant | Après |
|----------|-------|-------|
| **Nombre de fichiers** | 33 | 29 |
| **Taille totale** | ~234 KB | ~223 KB |
| **Fichiers inutiles** | 5 | 0 |
| **Bugs manifest** | 4 | 0 |
| **Fichiers manquants** | 1 | 0 |

---

## ✔️ Validations effectuées

- ✓ Tous les manifests utilisent des chemins relatifs corrects
- ✓ Pas de doublons d'icônes
- ✓ Pas de références à des fichiers supprimés
- ✓ structure de dossiers cohérente
- ✓ Workflow CI/CD compatible (build-apk.yml inchangé)

---

## 🚀 Prochaines étapes recommandées

1. **Déployer via GitHub** :
   ```bash
   git clone --bare /mnt/user-data/outputs/PWA-Claude-v2-CLEAN-*.zip
   cd repo.git
   git push --mirror https://github.com/guillaumedieul-dawa/PWA-Claude.git
   ```

2. **Déclencher le workflow** : Créer une release v2.0.0-clean sur GitHub Actions

3. **Tester l'APK** : Vérifier que `sw.js` cache correctement tous les assets

---

**ZIP généré avec succès** ✨

