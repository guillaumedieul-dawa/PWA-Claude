# FamilyHub — Système de Thèmes · Livraison 27/05 04h25

## Fichiers livrés

### Fichiers transverses (racine du repo)
| Fichier | Rôle |
|---------|------|
| `themes.css` | Variables CSS pour 3 thèmes : light / dark / sepia |
| `theme.js` | IIFE — init thème, sélecteur 3 pastilles, window.toggleTheme() |

### Pages HTML modifiées
| Fichier | Changements |
|---------|-------------|
| `index.html` | Link themes.css + script theme.js + suppression fonctions inline |
| `locker-tracker/index.html` | Idem + :root & dark supprimés |
| `todo-partage/index.html` | Idem |
| `liste-courses/index.html` | Idem |
| `cave-spiritueux/index.html` | Idem |
| `menus-semaine/index.html` | Idem |

## Ce qui a changé

- `:root {}` et `[data-theme="dark"] {}` **supprimés** de chaque HTML
- Remplacés par `<link rel="stylesheet" href="../themes.css">` (ou `href="themes.css"` pour la racine)
- `applyTheme()`, `toggleTheme()`, `initTheme()` **supprimés** de chaque HTML
- Remplacés par `<script src="../theme.js"></script>` (placé dans `<head>`)
- Les boutons `data-action="toggleTheme"` continuent de fonctionner via `window.toggleTheme()`
- Le sélecteur 3 pastilles est **injecté automatiquement** par theme.js au chargement

## Migration localStorage
- Ancienne clé : `lt_th` (light|dark)
- Nouvelle clé : `fh_theme` (light|dark|sepia)
- theme.js lit `fh_theme`, fallback sur `prefers-color-scheme`

## Thèmes disponibles
| Nom | data-theme | Description |
|-----|-----------|-------------|
| Clair | `light` | Cream & Ink — fond ivoire #faf7f2 |
| Sombre | `dark` | Encre de nuit — fond #1a1714 |
| Sépia | `sepia` | Parchemin — fond #f5ead6 |

## Installation
Copier tous les fichiers dans le repo en respectant les chemins ci-dessus.
