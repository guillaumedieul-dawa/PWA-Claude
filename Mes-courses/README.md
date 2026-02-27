# 🛒 Ma Liste de Courses — Guide d'installation

## 📦 Fichiers à envoyer
- `index.html` — l'application complète
- `sw.js` — mode hors-ligne
- `manifest.json` — installation Android

---

## 📲 Installer sur chaque téléphone (2 minutes par téléphone)

### Méthode recommandée : WhatsApp / Email

1. **Envoyez le fichier `index.html`** par WhatsApp ou email à chaque membre de la famille
2. Sur le téléphone destinataire : **ouvrir le fichier reçu avec Chrome**
3. Dans Chrome, menu **⋮ → Ajouter à l'écran d'accueil**
4. L'app apparaît comme une icône native sur l'écran d'accueil ✅

> ⚠️ Bien utiliser **Chrome** (pas Samsung Internet, pas Firefox).  
> Sur certains téléphones : Chrome affiche une bannière "Installer" automatiquement.

---

## 🔄 Comment fonctionne la synchronisation P2P

La sync utilise **WebRTC** (même technologie que les appels vidéo) — directement de téléphone à téléphone, **sans serveur, sans compte**.

### Premier téléphone (le "créateur")
1. Ouvrir l'app → choisir **"Liste partagée (sync P2P)"** → entrer son prénom
2. Un **code à 6 chiffres** s'affiche (ex: `482 319`)
3. Partager ce code par WhatsApp aux autres membres

### Autres téléphones (les "rejoignants")
1. Ouvrir l'app → choisir **"Liste partagée (sync P2P)"** → entrer son prénom
2. Entrer le **code à 6 chiffres** reçu dans le champ "Rejoindre un salon"
3. → Connexion établie, listes synchronisées ✅

### En cours d'utilisation
- Chaque ajout / suppression / coche est **transmis instantanément** à tous les téléphones connectés
- Si un téléphone est hors-ligne : les modifications sont **sauvegardées localement**
- Les autres téléphones se reconnectent automatiquement à la prochaine ouverture de l'app
- Le badge **"Sync"** en haut de l'écran indique l'état de connexion

---

## ❓ Questions fréquentes

**Les téléphones doivent-ils être sur le même réseau Wi-Fi ?**  
Non ! La connexion P2P fonctionne en 4G/5G comme en Wi-Fi, tant qu'il y a une connexion internet.

**Faut-il reconfigurer à chaque ouverture ?**  
Non. L'app mémorise le code et se reconnecte automatiquement.

**Que se passe-t-il si le créateur du salon éteint son téléphone ?**  
Les autres téléphones conservent leur liste en local. Ils se resynchronisent dès que quelqu'un avec le même code rouvre l'app.

**Peut-on ajouter des magasins ?**  
Oui, depuis le bouton **＋** en haut à droite. Les magasins ajoutés sont synchronisés à tous.

---

## 🏪 Magasins configurés par défaut
- 🛒 Super U
- 🚗 Chronodrive (lien vers l'app)
- 💊 Pharmacie
- 🛠️ Castorama
- 🌿 Natureo / Naturalia
