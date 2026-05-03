# 📚 Guide de Refactorisation — firebaseSync.js

## 🎯 Objectif

Éliminer la duplication de code Firebase dans les 5 sous-apps en centralisant les fonctions communes dans une seule bibliothèque : **firebaseSync.js**

---

## 📊 Impact

| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| **Code dupliqué** | 5 × (`toFields`, `fromFields`, `fbUrl`, etc.) | 1 × (`firebaseSync.js`) | -80% duplication |
| **Taille par app** | ~26–27 KB | ~24–25 KB | -2 KB/app |
| **Maintenance** | 5 copies à maintenir | 1 source unique | 5× plus facile |
| **Bug fixes** | À appliquer 5 fois | 1 fix centralisé | Instantané |

---

## 🔧 Utilisation

### Option 1 : Global (recommandé pour PWA)

```html
<!-- Dans chaque <head> des index.html -->
<script src="../firebaseSync.js"></script>

<!-- Puis dans vos scripts, tout est disponible globalement -->
<script>
  // Utiliser FBSync.* ou les fonctions directement
  const tasks = await fbReadAll('meta/todo/tasks');
  await fbWrite('meta/todo/tasks', 'task-001', {title: 'Test'});
</script>
```

### Option 2 : Module ES6

```javascript
import {
  fbReadAll,
  fbWrite,
  fbDelete,
  fbCreateSyncHandler
} from '../firebaseSync.js';

// Utiliser directement
const tasks = await fbReadAll('meta/todo/tasks');
```

### Option 3 : Créer un handler typé par sous-app

```javascript
// Au démarrage de todo-partage/index.html
const todoSync = fbCreateSyncHandler('meta/todo/tasks');

// Puis utiliser partout :
const tasks = await todoSync.readAll();
await todoSync.write('task-001', {title: 'Test', done: false});
await todoSync.delete('task-001');
```

---

## 🔄 Avant/Après Refactorisation

### ❌ AVANT — Duplication (todo-partage)

```html
<!-- Lignes 155–199 dans index.html -->

<script>
const FB_PROJECT = 'familyhub-colis-8abbd';
const FB_COLL = 'meta/todo/tasks';

function getFBKey() {
  try { 
    const s = JSON.parse(localStorage.getItem('lt_fb')); 
    return s && s.apiKey ? s.apiKey : ''; 
  } catch { return ''; }
}

function fbUrl(path) {
  return 'https://firestore.googleapis.com/v1/projects/' + FB_PROJECT +
    '/databases/(default)/documents/' + path + '?key=' + getFBKey();
}

function toFields(obj) {
  const f = {};
  for (const k in obj) {
    const v = obj[k];
    if (v === null || v === undefined) f[k] = {nullValue: null};
    else if (typeof v === 'boolean')  f[k] = {booleanValue: v};
    else if (typeof v === 'number')   f[k] = {integerValue: String(v)};
    else                              f[k] = {stringValue: String(v)};
  }
  return f;
}

function fromFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const k in fields) {
    const v = fields[k];
    if ('booleanValue' in v)  obj[k] = v.booleanValue;
    else if ('integerValue' in v) obj[k] = parseInt(v.integerValue);
    else if ('stringValue' in v)  obj[k] = v.stringValue;
    else obj[k] = null;
  }
  return obj;
}

async function fbWriteTask(task) {
  const key = getFBKey(); if (!key) return;
  try {
    await fetch(fbUrl(FB_COLL + '/' + task.id), {
      method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({fields: toFields(task)})
    });
  } catch(e) { console.warn('fbWriteTask', e); }
}

async function fbLoadAll() {
  const key = getFBKey(); if (!key) return;
  try {
    const r = await fetch(fbUrl(FB_COLL));
    if (!r.ok) return null;
    const data = await r.json();
    return (data.documents || []).map(doc => {
      const obj = fromFields(doc.fields);
      obj.id = doc.name.split('/').pop();
      return obj;
    });
  } catch(e) { console.warn('fbLoadAll', e); return null; }
}

async function fbDeleteTask(id) {
  const key = getFBKey(); if (!key) return;
  try {
    await fetch(fbUrl(FB_COLL + '/' + id), {method:'DELETE'});
  } catch(e) { console.warn('fbDeleteTask', e); }
}
</script>
```

**→ 80 lignes de code dupliqué × 4 apps = 320 lignes**

---

### ✅ APRÈS — Centralisé (todo-partage refactorisé)

```html
<!-- Dans <head> -->
<script src="../firebaseSync.js"></script>

<!-- Puis dans votre code métier (50 lignes au lieu de 80) -->
<script>
const todoSync = fbCreateSyncHandler('meta/todo/tasks');

async function fbWriteTask(task) {
  return await todoSync.write(task.id, task);
}

async function fbLoadAll() {
  return await todoSync.readAll();
}

async function fbDeleteTask(id) {
  return await todoSync.delete(id);
}

// OU directement :
// const tasks = await fbReadAll('meta/todo/tasks');
// await fbWrite('meta/todo/tasks', 'task-001', {...});
// await fbDelete('meta/todo/tasks', 'task-001');
</script>
```

**→ Gains : +200 lignes de code économisées au total**

---

## 📋 Plan d'intégration par sous-app

### 1️⃣ **locker-tracker**

**État actuel** :
- `fbU()`, `fbR()`, `fbW()`, `fbDel()` — minifiés, utilise `doubleValue`

**Migration** :
```javascript
// Remplacer
async function fbW(id, obj) { ... }
async function fbR() { ... }

// Par
const lockerSync = fbCreateSyncHandler('meta/colis', {numberType: 'double'});
// Puis utiliser lockerSync.write(), lockerSync.readAll()
```

**Fichier** : `/locker-tracker/index.html` (lignes ~530-620)

---

### 2️⃣ **todo-partage**

**État actuel** : 
- `fbLoadAll()`, `fbWriteTask()`, `fbDeleteTask()`
- Utilise `integerValue` pour les nombres

**Migration** :
```javascript
const todoSync = fbCreateSyncHandler('meta/todo/tasks');
// Envelopper dans les noms existants si souhaité
```

**Fichier** : `/todo-partage/index.html` (lignes ~155–220)

---

### 3️⃣ **cave-spiritueux**

**État actuel** :
- `fbLoadAllV()`, `fbWriteBottle()`, `fbDeleteBottle()` — suffixes "V"
- Utilise `integerValue`

**Migration** :
```javascript
const caveSync = fbCreateSyncHandler('meta/cave/bottles');
```

**Fichier** : `/cave-spiritueux/index.html` (lignes ~178–240)

---

### 4️⃣ **menus-semaine**

**État actuel** :
- `fbMenusReadAll()`, `fbMenusWrite()` — pas de DELETE
- Utilise `integerValue`

**Migration** :
```javascript
const menusSync = fbCreateSyncHandler('meta/menus');
```

**Fichier** : `/menus-semaine/index.html` (lignes ~200–260)

---

### 5️⃣ **liste-courses**

**État actuel** :
- `fbLoadAllC()`, `fbWriteItem()`, `fbDeleteItem()` — suffixes "C"
- Utilise `integerValue`

**Migration** :
```javascript
const coursesSync = fbCreateSyncHandler('meta/courses/items');
```

**Fichier** : `/liste-courses/index.html` (lignes ~200–260)

---

## 🔐 Compatibilité rétroactive

`firebaseSync.js` exporte des **aliases** pour l'ancien code :

```javascript
window.toFields      = toFirestoreFields;  // Ancien nom
window.fromFields    = fromFirestoreFields;
window.fbUrl         = fbUrl;
window.getFBKey      = getFBKey;
```

✅ **Aucun changement requis immédiatement** — Le code existant continue de fonctionner.

---

## 🚀 Étapes de migration graduelles

### Phase 1 (immédiate) : Copier firebaseSync.js
- Ajouter `<script src="../firebaseSync.js"></script>` dans chaque index.html
- ✓ Tout fonctionne comme avant (aliases)

### Phase 2 (semaine 1) : Refactoriser 1 app
- Choisir **todo-partage** ou **liste-courses** (plus simple)
- Remplacer `fbLoadAll()`, `fbWriteTask()`, `fbDeleteTask()` par `todoSync.*()`
- Tester en local

### Phase 3 (semaine 2-3) : Refactoriser les autres
- cave-spiritueux → `caveSync`
- menus-semaine → `menusSync`
- locker-tracker → `lockerSync` (dernier, plus complexe)

### Phase 4 (après validation) : Cleanup
- Supprimer les fonctions dupliquées de chaque app
- Garder les wrappers typés (`fbWriteTask`, `fbLoadAll`) si UI les utilise

---

## 📈 API Reference

### Configuration

```javascript
fbIsConfigured()          // boolean — vérifie si config valide
fbGetConfig()             // object — retourne la config
fbSetConfig(config)       // void — définit la config
getFBKey()                // string — obtient la clé API
fbUrl(path)               // string — construit URL Firestore
```

### Transformations

```javascript
toFirestoreFields(obj, 'integer'|'double')
  // JS object → Firestore fields

fromFirestoreFields(fields)
  // Firestore fields → JS object
```

### CRUD

```javascript
await fbReadAll(collection)           // Promise<array|null>
await fbWrite(collection, id, data)   // Promise<boolean>
await fbDelete(collection, id)        // Promise<boolean>
```

### Utilitaires

```javascript
const sync = fbCreateSyncHandler(collection, options)
  // sync.readAll(), sync.write(id, data), sync.delete(id)
```

---

## ✅ Checklist de validation post-refactorisation

- [ ] `firebaseSync.js` présent et chargé dans tous les apps
- [ ] Ancien code continue de fonctionner (aliases)
- [ ] 1 app entièrement migrée et testée
- [ ] Vérifier que `localStorage['lt_fb']` est partagée
- [ ] Synchronisation bidirectionnelle fonctionne (modifier dans app1, voir dans app2)
- [ ] Pas d'erreur console
- [ ] Taille totale du repo diminuée de ~30 KB

---

## 🐛 Troubleshooting

**"fbReadAll is not a function"**
→ Vérifier que `<script src="../firebaseSync.js"></script>` est présent

**"No Firebase key found"**
→ Vérifier que `localStorage['lt_fb']` est défini

**"404 on Firestore"**
→ Vérifier le `collection` path exact (ex: `meta/todo/tasks`, pas `meta/todo`)

**Les nombres sont en `doubleValue` au lieu de `integerValue`**
→ Utiliser `fbCreateSyncHandler(collection, {numberType: 'double'})`

---

## 📞 Questions fréquentes

**Q: Faut-il recompiler l'APK après cette refactorisation?**
A: Non, `firebaseSync.js` est du JavaScript standard. Recompiler juste pour tester en APK.

**Q: Et si je dois ajouter une nouvelle sous-app?**
A: Créer simplement `const newSync = fbCreateSyncHandler('meta/nouvelleApp/items')` et utiliser.

**Q: Peut-on revenir à l'ancien code si problème?**
A: Oui, `firebaseSync.js` est complètement optionnel grâce aux aliases. Ou supprimer le `<script>` et restaurer les anciennes fonctions.

---

## 📁 Structure après refactorisation

```
PWA-Claude-clean/
├── firebaseSync.js          ← NOUVEAU (centralisé)
├── locker-tracker/
│   └── index.html           (à refactoriser)
├── todo-partage/
│   └── index.html           (à refactoriser)
├── cave-spiritueux/
│   └── index.html           (à refactoriser)
├── menus-semaine/
│   └── index.html           (à refactoriser)
└── liste-courses/
    └── index.html           (à refactoriser)
```

---

**Refactorisation prête à démarrer ! 🚀**
