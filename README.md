# 🏠 FamilyHub v2 — Dieul-Gandet

Hub familial avec **5 applications** intégrées, packagé en APK Android via Capacitor + GitHub Actions.

## Applications incluses

| App | Description | Fonctionnalités clés |
|-----|-------------|---------------------|
| 📦 **Suivi Colis** | Tracking livraisons & consignes | Lecture SMS, Gmail sync |
| 🛒 **Liste de Courses** | Liste partagée en temps réel | Sync P2P WebRTC |
| ✅ **To-Do Partagé** | Tâches familiales assignables | Catégories, priorités, assignation |
| 🍷 **Cave & Spiritueux** | Inventaire vins/rhums/whiskies | Quantités, notes, valeur |
| 🍽️ **Menus Semaine** | Planification des repas | Semaine/mois, suggestions auto |

## Stack technique

- **Frontend** : HTML/CSS/JS pur (zéro dépendance externe pour les apps)
- **PWA** : Service Worker + Manifest (offline, installable)
- **APK Android** : Capacitor 5 + Gradle
- **CI/CD** : GitHub Actions (build gratuit)
- **Stockage** : localStorage (offline) — sync P2P WebRTC pour courses
- **Coût** : **0€** (tout gratuit)

## Build APK

### Via GitHub Actions (recommandé)
1. Pousser sur la branche `main`
2. Aller dans **Actions** → **Build FamilyHub APK**
3. Télécharger l'APK dans **Artifacts**

### En local
```bash
npm install
npx cap add android    # première fois
npx cap sync android
cd android && ./gradlew assembleDebug
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```

## Installation sur téléphone

1. Transférer l'APK sur le Samsung Galaxy S23 / OnePlus Nord 8
2. Autoriser "Sources inconnues" dans Paramètres > Sécurité
3. Installer l'APK
4. Accorder les permissions SMS et Gmail au premier lancement

## Thème & Design

- **Couleurs** : Bleu & vert, teintes steampunk modernes
- **Mode nuit/jour** : Automatique selon le système Android
- **Police** : Josefin Sans + Rajdhani + Share Tech Mono
- **Responsive** : Optimisé Samsung Galaxy S23 / OnePlus Nord Pro 8

## Architecture des données

Toutes les données sont stockées en **localStorage** (offline, privé, gratuit).
La synchronisation entre Guillaume et Michèle se fait via **WebRTC P2P** (liste de courses)
ou via **partage de code** sans serveur tiers.

## Sécurité

- ✅ Pas de cleartext HTTP
- ✅ Pas de secrets codés en dur
- ✅ Permissions Android minimales
- ✅ Vérification automatique à chaque build (GitHub Actions)

## Utilisateurs

| Utilisateur | Email | Téléphone |
|-------------|-------|-----------|
| Guillaume Dieul | guillaume.dieul@gmail.com | Android |
| Michèle Grassiot Gandet | Michele.gandet@gmail.com | Android |

**Adresse** : 21 rue du Beauregard, Pierrelaye
