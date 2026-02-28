# 📱 Compiler LockerTrack APK depuis votre téléphone

## Architecture

```
Votre téléphone
     │
     │  push sur GitHub
     ▼
GitHub Actions (machine virtuelle Ubuntu dans le cloud)
     │  installe Node.js, Java 17, Android SDK
     │  npx cap sync android
     │  ./gradlew assembleDebug
     ▼
APK disponible dans l'onglet "Actions" → "Artifacts"
     │
     │  téléchargement
     ▼
Votre téléphone → installation
```

---

## 🗂️ Structure à pousser sur GitHub

```
votre-repo/
├── .github/
│   └── workflows/
│       └── build-apk.yml          ← Workflow de build
├── locker-tracker/
│   ├── index.html                 ← App LockerTrack
│   ├── manifest.json
│   ├── sw.js
│   └── sms-bridge.js              ← Module SMS (NOUVEAU)
├── liste-courses/
│   └── index.html
├── icons/
│   └── *.png
├── android/
│   └── app/src/main/
│       └── AndroidManifest.xml    ← Permissions SMS
├── capacitor.config.json          ← Config Capacitor
├── package.json                   ← Dépendances npm
└── index.html                     ← Page d'accueil
```

---

## 🚀 Étapes depuis votre téléphone

### 1. Uploader les nouveaux fichiers sur GitHub

Sur **github.com** depuis Chrome mobile :

1. Allez dans votre dépôt
2. Pour chaque fichier :
   - Naviguez vers le bon dossier
   - **Add file → Upload files** (ou cliquez sur un fichier existant → ✏️ Edit)
   - Collez/uploadez le contenu
   - **Commit changes**

**Fichiers à ajouter/remplacer :**
- `package.json` → à la racine
- `capacitor.config.json` → à la racine
- `.github/workflows/build-apk.yml` → créer les dossiers
- `android/app/src/main/AndroidManifest.xml` → créer les dossiers
- `locker-tracker/sms-bridge.js` → dans le dossier locker-tracker
- `locker-tracker/index.html` → remplacer par la version mise à jour

> 💡 **Astuce** : Créez un dossier sur GitHub en nommant le fichier `dossier/sous-dossier/fichier.txt`

---

### 2. Déclencher le build

Le build se lance **automatiquement** à chaque push.

Ou manuellement :
1. Onglet **Actions** de votre dépôt
2. **Build LockerTrack APK** dans la liste à gauche
3. **Run workflow** → **Run workflow**

---

### 3. Attendre et télécharger l'APK

1. Onglet **Actions** → cliquez sur le build en cours (cercle jaune ⟳)
2. Attendez ~10-15 minutes (la première fois, plus long car téléchargement SDK Android)
3. En bas de la page → section **Artifacts**
4. Cliquez **LockerTrack-debug-XXX** → téléchargement d'un `.zip`
5. Dézippez → vous obtenez `LockerTrack-debug.apk`

---

### 4. Installer l'APK

1. **Paramètres → Sécurité → Sources inconnues** → Autoriser Chrome (ou Fichiers)
2. Ouvrez le fichier `.apk` depuis le gestionnaire de fichiers
3. **Installer** → **Ouvrir**

---

## 🔐 APK Release signé (optionnel, pour Play Store)

Pour un APK signé (requis pour publier sur le Play Store) :

### Générer un keystore

Depuis [Keystore Generator](https://keystore-generator.com/) sur votre téléphone, ou en ligne de commande si vous avez un accès SSH :

```bash
keytool -genkey -v -keystore lockertrack.jks \
  -alias lockertrack -keyalg RSA -keysize 2048 -validity 10000
```

### Ajouter les secrets GitHub

Dans votre dépôt → **Settings → Secrets and variables → Actions** :

| Secret | Valeur |
|--------|--------|
| `KEYSTORE_BASE64` | Contenu du `.jks` encodé en base64 |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `KEY_ALIAS` | `lockertrack` |
| `KEY_PASSWORD` | Mot de passe de la clé |

Encoder le keystore en base64 :
```bash
base64 -w 0 lockertrack.jks
```

Une fois les secrets configurés, le workflow génère automatiquement un APK release signé en plus du debug.

---

## 📱 Fonctionnement des SMS dans l'APK

### Permission demandée au premier lancement
L'app demande l'autorisation de lire les SMS. Appuyez **Autoriser**.

### Onglet Comptes → Section SMS
- **APK natif** : bouton "Autoriser et synchroniser les SMS" → lit automatiquement les 90 derniers jours
- **PWA web** : champ de saisie manuelle pour coller un SMS

### SMS détectés automatiquement
Chronopost, Colissimo, Mondial Relay, La Poste, Vinted Go, Amazon, DPD, UPS

### Ce qui est extrait de chaque SMS
- Transporteur
- Numéro de suivi
- Code de retrait (4-8 chiffres)
- Adresse du point relais / locker
- Statut (en route / disponible / expiré)
- Date d'expiration estimée

---

## ❓ Problèmes fréquents

**Le build échoue avec "SDK not found"**
→ Vérifiez que `sdkmanager` est accessible. Le workflow l'installe automatiquement.

**Le build dure plus de 30 minutes**
→ Augmentez `timeout-minutes` dans le workflow.

**READ_SMS n'est pas dans le manifest**
→ Le step "Patch AndroidManifest" le réinjecte automatiquement.

**L'APK s'installe mais les SMS ne sont pas lus**
→ Allez dans Paramètres → Apps → LockerTrack → Permissions → SMS → Autoriser.

**"Bridge SMS non chargé"**
→ Vérifiez que `sms-bridge.js` est bien dans le dossier `locker-tracker/`.
