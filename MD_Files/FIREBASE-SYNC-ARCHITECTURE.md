# 🏗️ ARCHITECTURE FIREBASE SYNCHRONISÉE

## Structure visuelle de la synchronisation

```
┌─────────────────────────────────────────────────────────────────┐
│         FamilyHub v2 — 5 Sous-applications (PWA)               │
└─────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ↓                  ↓                  ↓
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ Locker      │   │ Todo        │   │ Cave        │
    │ Tracker     │   │ Partagé     │   │ Spiritueux  │
    └─────────────┘   └─────────────┘   └─────────────┘
           │                  │                  │
           │    ┌─────────────┼─────────────┐   │
           │    │             │             │   │
           ↓    ↓             ↓             ↓   ↓
    ┌────────────────────────────────────────────────┐
    │  localStorage['lt_fb']                         │
    │  {apiKey, projectId}                          │
    │  (Configuration Firebase partagée)            │
    └────────────────────────────────────────────────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              ↓
    ┌────────────────────────────────────────────────────────┐
    │  Firebase REST API (v1/documents/)                      │
    │  https://firestore.googleapis.com/v1/projects/...       │
    └────────────────────────────────────────────────────────┘
           ↓                  ↓                  ↓
    ┌────────────────────────────────────────────────────────┐
    │  familyhub-colis-8abbd (Firestore Database)            │
    ├────────────────────────────────────────────────────────┤
    │                                                        │
    │  meta/                                                │
    │  ├── colis/              ← locker-tracker             │
    │  │   ├── doc1                                         │
    │  │   ├── doc2                                         │
    │  │   └── ...                                          │
    │  │                                                    │
    │  ├── todo/tasks/         ← todo-partage              │
    │  │   ├── task1                                        │
    │  │   ├── task2                                        │
    │  │   └── ...                                          │
    │  │                                                    │
    │  ├── cave/bottles/       ← cave-spiritueux           │
    │  │   ├── bottle1                                      │
    │  │   ├── bottle2                                      │
    │  │   └── ...                                          │
    │  │                                                    │
    │  ├── menus/              ← menus-semaine             │
    │  │   ├── 2026-05-01                                   │
    │  │   ├── 2026-05-02                                   │
    │  │   └── ...                                          │
    │  │                                                    │
    │  └── courses/items/      ← liste-courses             │
    │      ├── item1                                        │
    │      ├── item2                                        │
    │      └── ...                                          │
    │                                                        │
    └────────────────────────────────────────────────────────┘
```

---

## Flux de synchronisation CRUD détaillé

### 1. CREATE/UPDATE → PATCH

```javascript
// Pattern sur tous les apps
async function fbWrite[Type](object) {
    // 1. Construire l'URL Firestore
    const url = fbUrl(COLLECTION + '/' + object.id);
    
    // 2. Transformer objet JS → Firestore fields
    const fields = toFields(object);
    
    // 3. Envoyer via PATCH (PUT/PATCH selon Firestore)
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey  // (via URL, pas header)
        },
        body: JSON.stringify({fields: fields})
    });
}

// Exemple : objet local
const task = {id: 'abc123', title: 'Faire les courses', done: false};

// ↓ toFields() ↓
{
  title: {stringValue: 'Faire les courses'},
  done: {booleanValue: false}
}

// ↓ Envoyé à Firestore ↓
// PATCH /projects/familyhub-colis-8abbd/databases/(default)/documents/meta/todo/tasks/abc123
```

### 2. READ → GET

```javascript
async function fbLoadAll() {
    // 1. Construire l'URL collection
    const url = fbUrl(COLLECTION);
    
    // 2. Fetch simple GET
    const response = await fetch(url);
    const data = await response.json();
    
    // 3. Transformer Firestore fields → JS objects
    return data.documents.map(doc => fromFields(doc.fields));
}

// Réponse Firestore :
{
  documents: [
    {
      name: 'projects/.../meta/todo/tasks/abc123',
      fields: {
        title: {stringValue: 'Faire les courses'},
        done: {booleanValue: false}
      }
    }
  ]
}

// ↓ fromFields() ↓
{id: 'abc123', title: 'Faire les courses', done: false}
```

### 3. DELETE → DELETE

```javascript
async function fbDelete(id) {
    const url = fbUrl(COLLECTION + '/' + id);
    await fetch(url, {method: 'DELETE'});
}

// DELETE /projects/familyhub-colis-8abbd/databases/(default)/documents/meta/courses/items/xyz789
```

---

## Transformation de champs (Field Conversion)

### toFields() — JS → Firestore

```javascript
Input:  {title: 'TODO', count: 42, active: true, note: null}

Process (for-in loop) :
  title: 'TODO'           → {stringValue: 'TODO'}
  count: 42               → {integerValue: '42'}    ← Note: String pour int
  active: true            → {booleanValue: true}
  note: null              → {nullValue: null}

Output: {
  title: {stringValue: 'TODO'},
  count: {integerValue: '42'},
  active: {booleanValue: true},
  note: {nullValue: null}
}
```

### fromFields() — Firestore → JS

```javascript
Input: {
  title: {stringValue: 'TODO'},
  count: {integerValue: '42'},
  active: {booleanValue: true},
  note: {nullValue: null}
}

Process (field-by-field check) :
  title.stringValue exists        → obj.title = 'TODO'
  count.integerValue exists       → obj.count = parseInt('42')
  active.booleanValue exists      → obj.active = true
  note.nullValue exists           → obj.note = null

Output: {title: 'TODO', count: 42, active: true, note: null}
```

---

## Configuration Firebase (localStorage)

### Stockage unique partagé

```javascript
// localStorage['lt_fb'] — utilisé par TOUS les apps
{
  "projectId": "familyhub-colis-8abbd",
  "apiKey": "AIzaSyD...",              // Clé Web Firebase
  "authDomain": "...",
  "databaseURL": "...",
  "storageBucket": "..."
}
```

### Récupération (5 variantes, même source)

```javascript
// locker-tracker
function getFB() {
  return JSON.parse(localStorage.getItem('lt_fb')).apiKey;
}

// todo-partage
function getFBKey() {
  try { 
    const s = JSON.parse(localStorage.getItem('lt_fb')); 
    return s && s.apiKey ? s.apiKey : ''; 
  } catch { return ''; }
}

// cave-spiritueux
function getFBKeyV() { /* identique à todo */ }

// menus-semaine
function getFBKeyM() { /* identique à todo */ }

// liste-courses
function getFBKeyC() { /* identique à todo */ }
```

**Implication** : Configuration singleton — modifier `lt_fb` = mise à jour pour tous les apps.

---

## Collections Firestore (Organisation)

```
familyhub-colis-8abbd/
├── meta/
│   ├── colis/                  [locker-tracker]
│   │   ├── 1ZA2E708DK99460766
│   │   ├── 1UW1AWL350142
│   │   └── ...
│   │
│   ├── todo/
│   │   ├── tasks/              [todo-partage]
│   │   │   ├── task-001
│   │   │   ├── task-002
│   │   │   └── ...
│   │   │
│   │   └── (future: recurring, templates, etc.)
│   │
│   ├── cave/
│   │   ├── bottles/            [cave-spiritueux]
│   │   │   ├── bottle-001
│   │   │   ├── bottle-002
│   │   │   └── ...
│   │   │
│   │   └── (future: wines, rums, whiskies séparés)
│   │
│   ├── menus/                  [menus-semaine]
│   │   ├── 2026-05-01
│   │   │   ├── lunch: {...}
│   │   │   ├── dinner: {...}
│   │   │   └── ...
│   │   │
│   │   └── 2026-05-02
│   │       └── ...
│   │
│   └── courses/
│       ├── items/              [liste-courses]
│       │   ├── item-001
│       │   ├── item-002
│       │   └── ...
│       │
│       └── (future: categories, recurring, etc.)
```

---

## Schéma de données par sub-app

### locker-tracker (colis)

```firestore
{
  "id": "1ZA2E708DK99460766",
  "shipper": "UPS",
  "from": "MAITROX SERVICE (SPAIN) SL",
  "to": "GUILLAUME DIEUL",
  "status": "En transit",
  "estimatedDelivery": "2025-12-19",
  "events": [
    {shipDate: "2025-12-17", status: "En route"},
    {shipDate: "2025-12-18", status: "En livraison"}
  ]
}
```

### todo-partage (tasks)

```firestore
{
  "id": "task-001",
  "title": "Faire les courses",
  "done": false,
  "assignee": "Guillaume",
  "dueDate": "2026-05-05"
}
```

### cave-spiritueux (bottles)

```firestore
{
  "id": "bottle-001",
  "name": "Talisker 10",
  "type": "whisky",
  "vintage": 2010,
  "quantity": 1,
  "location": "Étagère 2"
}
```

### menus-semaine (menus)

```firestore
{
  "classique": "Pâtes carbonara",
  "vegetarien": "Ratatouille",
  "enfants": "Pâtes beurre parmesan"
}
```

### liste-courses (items)

```firestore
{
  "id": "item-001",
  "name": "Lait",
  "quantity": 1,
  "unit": "L",
  "category": "Produits laitiers",
  "purchased": false
}
```

---

## Synchronisation bidirectionnelle

```
User Action (Locker)          User Action (Todo)          User Action (Courses)
      ↓                             ↓                            ↓
  Modifier colis              Cocher tâche                Cocher item
      ↓                             ↓                            ↓
  fbW() [PATCH]              fbWriteTask() [PATCH]       fbWriteItem() [PATCH]
      ↓                             ↓                            ↓
  Firestore                   Firestore                    Firestore
      ↓                             ↓                            ↓
  (Document mis à jour)       (Document mis à jour)        (Document mis à jour)
      ↓                             ↓                            ↓
  (Real-time listener         (Real-time listener         (Real-time listener
   n'existe PAS ⚠️)            n'existe PAS ⚠️)             n'existe PAS ⚠️)
      ↓                             ↓                            ↓
  Refresh manuel ↻             Refresh manuel ↻             Refresh manuel ↻
```

**⚠️ NOTE** : Pas de listeners real-time (`onSnapshot`). Synchronisation à la demande via `fbLoadAll()`.

---

## Points forts de cette architecture

✅ **Centralisée** — Un projet Firebase unique, 5 apps = 1 source de vérité
✅ **Partitionnée** — Chaque app sa collection, pas de conflits
✅ **Stateless** — Pas d'état serveur complexe, juste REST API Firestore
✅ **Configurable** — apiKey en localStorage, modifiable sans redéploiement
✅ **Familiale** — Clé API partagée = synchronisation entre Guillaume & Michèle

---

## Points faibles (amélioration possible)

⚠️ **Pas de real-time** — Les 5 apps ne se voient pas changer en temps réel
⚠️ **Duplication de code** — `toFields()` répétée 5 fois (minification masque ça)
⚠️ **Pas de versioning** — Pas de `updatedAt` pour conflit resolution
⚠️ **Exposition apiKey** — La clé Web est visible en localStorage (habituel PWA)

