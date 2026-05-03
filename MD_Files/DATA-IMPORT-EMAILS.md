# 📧 DATA-IMPORT-EMAILS.md — Import des 60 Colis Gmail

**Date** : 02/05/2026  
**Scope** : Parser 60 PDFs Gmail + injecter dans Firestore  
**Priorité** : 🟡 Moyenne (amélioration UX future)  
**Effort** : 2-3h (avec testing)

---

## 📊 Ressources disponibles

### PDFs Google Gmail identifiés

**Total** : 60+ fichiers PDF (scope: `/mnt/project/*.pdf`)

#### Catégories trouvées

| Catégorie | Fichiers | Format |
|-----------|----------|--------|
| **UPS** | 7 | Notification d'envoi, My Choice alerts, Colis prêt |
| **Colissimo (La Poste)** | 12 | Votre colis arrive, livré, en consigne Pickup |
| **Chronopost** | 8 | En chemin, Pickup, livré |
| **Mondial Relay** | 12 | Changement relais, prise en charge, disponible |
| **DPD / Kurier DPD** | 5 | Prise en charge, reprogrammée, livraison |
| **Pickup (Chronofresh)** | 6 | Disponible en relais, reminders |
| **GLS France** | 1 | Votre colis arrive bientôt |
| **Vinted Go** | 4 | Colis arrive, récupère ton colis, rappel |
| **Amazon** | 2 | Expédié, mise à jour livraison |
| **Too Good To Go** | 2 | En chemin, arrivé, disponible |
| **Misc/Documentation** | 1 | (référence format) |

---

## 🔍 Format standardisé extrait

### Exemple 1: UPS

```
Source: Gmail - Notification d'envoi UPS, numéro de suivi 1ZA2E708DK99460766.pdf

Champs extraits:
  Transporteur: UPS
  NuméroSuivi: 1ZA2E708DK99460766
  Expéditeur: MAITROX SERVICE (SPAIN) SL
  Destinataire: GUILLAUME DIEUL, 21 RUE DU BEAUREGARD PIERRELAYE
  Statut: En route
  DateEstimée: 19/12/2025
  HeureEstimée: 11:15 - 14:15
  Signature: Oui
```

### Exemple 2: Colissimo

```
Source: Gmail - Votre colis a bien été livré !.pdf

Champs extraits:
  Transporteur: Colissimo
  NuméroColis: 6A04678403057
  Expéditeur: PHARMACIE PRADO-MERMOZ
  Destinataire: 21 RUE DU BEAUREGARD 95480 PIERRELAYE
  Statut: Livré
  DateLivraison: 03/12/2025
  Lieu: Boîte aux lettres (direct)
```

### Exemple 3: Mondial Relay

```
Source: Gmail - Le temps file, votre colis vous attend avec impatience.pdf

Champs extraits:
  Transporteur: Mondial Relay
  NuméroColis: 00041303
  Statut: Disponible
  DateDisponibilité: Depuis 11/04/2026
  LieuRetrait: SECURITEST HERBLAY, 20 Rue Berthe Morisot
  CodeRetrait: 487036
  DateLimitRetrait: 18/04/2026
```

### Exemple 4: Pickup/Chronopost

```
Source: Gmail - Votre colis TOO GOOD TO GO est arrivé dans votre consigne Pickup !.pdf

Champs extraits:
  Transporteur: Chronopost Pickup
  NuméroColis: XU323246946YY
  Expéditeur: TOO GOOD TO GO
  Statut: Disponible en consigne
  Consigne: Consigne Pickup Grand Frais Herblay
  Identifiant: 5241
  CodeOuverture: 9491
  DateLimitRetrait: 12/01/2026
```

---

## 🔧 Parseur proposé (JavaScript)

### Architecture

```javascript
class CancelEmailParser {
  constructor() {
    this.parsers = {
      'UPS': this.parseUPS.bind(this),
      'Colissimo': this.parseColissimo.bind(this),
      'Chronopost': this.parseChronopost.bind(this),
      'Mondial Relay': this.parseMondialRelay.bind(this),
      'DPD': this.parseDPD.bind(this),
      'GLS': this.parseGLS.bind(this),
      'Vinted Go': this.parseVintedGo.bind(this),
      'Amazon': this.parseAmazon.bind(this),
    };
  }

  parse(emailText) {
    // 1. Détecter le transporteur
    const transporteur = this.detectTransporteur(emailText);
    
    // 2. Parser selon le type
    const parser = this.parsers[transporteur];
    if (!parser) {
      console.warn(`Parser inconnu pour ${transporteur}`);
      return null;
    }
    
    // 3. Extraire les champs
    const colis = parser(emailText);
    
    // 4. Normaliser
    return this.normalize(colis);
  }

  detectTransporteur(text) {
    if (text.includes('UPS')) return 'UPS';
    if (text.includes('Colissimo')) return 'Colissimo';
    if (text.includes('Chronopost')) return 'Chronopost';
    if (text.includes('Mondial Relay')) return 'Mondial Relay';
    if (text.includes('DPD')) return 'DPD';
    if (text.includes('GLS')) return 'GLS';
    if (text.includes('Vinted Go')) return 'Vinted Go';
    if (text.includes('Amazon')) return 'Amazon';
    return null;
  }

  parseUPS(text) {
    return {
      transporteur: 'UPS',
      numeroSuivi: this.extract(text, /(\d[A-Z0-9]{11})/), // 1ZA2E708DK99460766
      expediteur: this.extract(text, /De (.*?)(?:\n|$)/),
      destinataire: this.extract(text, /Expédier à\s*(.*?)(?:\n|$)/),
      statut: text.includes('livré') ? 'Livré' : 'En transit',
      dateEstimee: this.extractDate(text),
    };
  }

  parseColissimo(text) {
    return {
      transporteur: 'Colissimo',
      numeroColis: this.extract(text, /n°(\d[A-Z0-9]+)/) || this.extract(text, /(\d[A-Z0-9]{10,})/),
      expediteur: this.extract(text, /par (.*?)(?:\s(?:a|sera)|\n|$)/),
      destinataire: this.extract(text, /à l'adresse.*?\n(.*?)(?:\n|$)/),
      statut: text.includes('livré') ? 'Livré' : 'En route',
      dateLivraison: this.extractDate(text),
      lieu: text.includes('Boîte aux lettres') ? 'Boîte aux lettres' : 'Consigne Pickup',
    };
  }

  parseMondialRelay(text) {
    return {
      transporteur: 'Mondial Relay',
      numeroColis: this.extract(text, /Colis n°(\d+)/),
      statut: text.includes('disponible') ? 'Disponible' : 'En transit',
      lieuRetrait: this.extract(text, /Point Relais.*\n(.*?)(?:\n|$)/),
      codeRetrait: this.extract(text, /CODE[^\n]*?(\d{6})/),
      dateLimitRetrait: this.extractDate(text, 'RETRAIT JUSQU'),
    };
  }

  parseChronopost(text) {
    return {
      transporteur: 'Chronopost',
      numeroColis: this.extract(text, /([A-Z0-9]{17})/), // XU323246946YY
      expediteur: this.extract(text, /expédié par (.*?)(?:\n|$)/),
      statut: text.includes('disponible') ? 'Disponible' : 'En chemin',
      lieu: this.extract(text, /Consigne Pickup (.*?)(?:\n|$)/) || 'Relais',
      codeOuverture: this.extract(text, /Code d'ouverture ?: (\d{4})/),
      dateLimitRetrait: this.extractDate(text),
    };
  }

  // Helpers
  extract(text, regex) {
    const match = text.match(regex);
    return match ? match[1] : null;
  }

  extractDate(text, marker = '') {
    // Chercher format JJ/MM/YYYY ou YYYY-MM-DD
    const regex = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/g;
    const matches = text.match(regex);
    if (!matches) return null;
    
    // Si marker donné, chercher date après le marker
    if (marker) {
      const idx = text.indexOf(marker);
      if (idx >= 0) {
        const after = text.substring(idx);
        const match = after.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        return match ? match[1] : null;
      }
    }
    
    return matches[matches.length - 1]; // Dernière date trouvée
  }

  normalize(colis) {
    // Normaliser le format pour Firestore
    if (!colis) return null;
    
    return {
      id: this.generateId(colis),
      transporteur: colis.transporteur,
      numeroSuivi: colis.numeroSuivi,
      expediteur: colis.expediteur || 'Inconnu',
      destinataire: colis.destinataire || 'Inconnu',
      statut: colis.statut || 'Inconnu',
      dateEstimee: colis.dateEstimee,
      dateLivraison: colis.dateLivraison,
      lieu: colis.lieu || '',
      codeRetrait: colis.codeRetrait || '',
      events: [
        {date: new Date().toISOString(), status: colis.statut}
      ],
      createdAt: new Date().toISOString(),
    };
  }

  generateId(colis) {
    // ID unique = numeroSuivi ou hash du contenu
    if (colis.numeroSuivi) return colis.numeroSuivi;
    return `${colis.transporteur}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## 📋 Données actuelles vs proposées

### Avant import

```
locker-tracker:
├── 1ZA2E708DK99460766 (UPS) — from Phase 1 demo
├── 1UW1AWL350142 (Vinted Go) — from Phase 1 demo
└── ... (à peine 2-3 colis de demo)

Impact: App vide, peu d'utilité réelle
```

### Après import (si implémenté)

```
locker-tracker:
├── 1ZA2E708DK99460766 (UPS) — existing
├── 1UW1AWL350142 (Vinted Go) — existing
├── 6A04678403057 (Colissimo) — imported
├── XU323246946YY (Chronopost) — imported
├── 00041303 (Mondial Relay) — imported
├── ... (60 colis total)

Impact: 
  ✅ App réaliste + testable
  ✅ Guillaume & Michèle voient leurs vrais colis
  ✅ Tracking actuel visible
  ✅ Démonstration auprès d'amis possible
```

---

## 🔄 Plan d'implémentation

### Étape 1 : Valider les PDFs (1h)

```javascript
// 1. Lire les 60 PDFs depuis /mnt/project/
const fs = require('fs');
const files = fs.readdirSync('/mnt/project/').filter(f => f.endsWith('.pdf'));
console.log(`Trouvé ${files.length} PDFs`);

// 2. Extraire le texte de chaque PDF
// Option A : pdfparse library (JavaScript)
const PDFParser = require('pdf-parse');
for (const file of files) {
  const text = await PDFParser(fs.readFileSync(file));
  console.log(`${file}: ${text.nPages} pages`);
}

// Option B : Utiliser un service externe (Cloudinary, etc.)
// Option C : Copier/coller manuel (fast pour 60 ✅)
```

### Étape 2 : Parser les emails (1h)

```javascript
// Utiliser la classe CancelEmailParser ci-dessus
const parser = new CancelEmailParser();

for (const file of files) {
  const text = await extractPDFText(file);
  const colis = parser.parse(text);
  
  if (colis) {
    console.log(`✅ ${file}: ${colis.numeroSuivi} (${colis.transporteur})`);
  } else {
    console.warn(`⚠️ ${file}: parsing failed`);
  }
}
```

### Étape 3 : Injecter dans Firestore (30 min)

```javascript
// Utiliser firebaseSync.js pour écrire en batch
const { fbWrite } = require('./firebaseSync.js');

for (const colis of colisList) {
  const success = await fbWrite(
    'meta/colis',
    colis.id,
    colis
  );
  
  if (success) {
    console.log(`✅ Firestore: ${colis.id}`);
  } else {
    console.error(`❌ Firestore: ${colis.id} failed`);
  }
}
```

### Étape 4 : Valider dans locker-tracker (30 min)

```
1. Builder APK
2. Ouvrir locker-tracker sur device
3. Vérifier que les 60 colis s'affichent
4. Filtrer par transporteur (UPS, Colissimo, etc.) ✅
5. Cliquer sur un colis → voir détails ✅
```

---

## 📊 Schéma Firestore pour colis

```javascript
{
  id: "1ZA2E708DK99460766",                      // Document ID
  transporteur: "UPS",                           // Category (filter)
  numeroSuivi: "1ZA2E708DK99460766",            // Unique identifier
  expediteur: "MAITROX SERVICE (SPAIN) SL",     // Shipper
  destinataire: "GUILLAUME DIEUL",               // Recipient
  adresse: "21 RUE DU BEAUREGARD, 95480...",    // Delivery address
  
  // Statut actuel
  statut: "Livré",                              // Livré | En transit | En retrait
  
  // Dates
  dateCreation: "2025-12-17T00:02:00Z",         // Quand importé
  dateEstimee: "2025-12-19T00:00:00Z",          // Expected delivery
  dateLivraison: "2025-12-18T12:18:00Z",        // Actual delivery
  
  // Lieu actuel (pour retrait)
  lieu: "21 RUE DU BEAUREGARD",                 // Direct or relay
  codeRetrait: null,                            // If relay
  dateLimitRetrait: null,                       // If not picked up
  
  // Signature requise ?
  signatureRequise: true,
  
  // Historique complet
  events: [
    {
      date: "2025-12-17T00:02:00Z",
      status: "En route",
      location: "SPAIN"
    },
    {
      date: "2025-12-18T12:18:00Z",
      status: "Livré",
      location: "21 RUE DU BEAUREGARD"
    }
  ],
  
  // Metadata
  source: "Email Gmail import",
  imported: true
}
```

---

## 🎯 Cas d'usage réels des 60 PDFs

### Use Case 1: Guillaume retrouve un vieux colis

```
Avant: "Où est passé mon colis Colissimo du 3 décembre ?"
  → Cherche dans Gmail, trouve le PDF, lit le PDF

Après: Ouvre locker-tracker
  → Filtre par "Colissimo"
  → Cherche "décembre" (date)
  → Clique → voir les détails (livré le 3/12, boîte aux lettres)
```

### Use Case 2: Michèle vérifie les codes de retrait

```
Avant: "Mon colis est arrivé au Mondial Relay. Quel est le code ?"
  → Relit l'email Gmail
  → Copie le code 487036 manuellement

Après: Ouvre locker-tracker
  → Cherche son colis (00041303)
  → Code retrait affiché directement dans l'app
  → Prêt pour retirer du relais
```

### Use Case 3: Déduplication de colis

```
Avant: 60 PDFs Gmail différentes (certains doublons)
  → Impossible de savoir combien de VRAIS colis

Après: Import + déduplication
  → Par numeroSuivi (unique)
  → 55 colis réels identificardés
```

---

## 🚨 Défis techniques

### Défi 1 : Extraction PDF → Texte

**Problème** : Les PDFs Gmail sont souvent des screenshots/images, pas du texte vectoriel.

**Solutions** :
1. ✅ **Copier-coller manuel** (rapide, 60 fichiers = 1h)
2. **OCR (Tesseract.js)** — +500KB NPM
3. **Service externe (Google Vision API)** — Coûteux

**Recommandation** : Copier-coller manuel pour 60 PDFs (30 min).

---

### Défi 2 : Variation format par transporteur

**Problème** : UPS format ≠ Colissimo format ≠ Chronopost.

**Solution** : Parser polymorphe (déjà implémenté ci-dessus).

**Taux de succès estimé** : 85-90% (certains formats non-standard).

---

### Défi 3 : Données incomplètes

**Problème** : Certains colis manquent le lieu final (retrait pas encore effectué).

**Solution** : Utiliser `null` pour champs manquants, laisser vides dans UI.

```javascript
{
  lieu: null,                      // Pas encore spécifié
  codeRetrait: null,               // N/A
  dateLimitRetrait: null,          // N/A
}

// UI gère gracieusement les nulls
```

---

## 📈 Impact & ROI

### Bénéfices

| Bénéfice | Valeur |
|----------|--------|
| **UX améliorée** | Guillaume/Michèle voient leurs vrais colis |
| **App réaliste** | 60 items de demo vs 2 items actuels |
| **Testabilité** | Données réelles pour valider filters, search |
| **Portfolio** | Démonstration fonctionnelle complète |
| **Future analytics** | Savoir quels carriers utilisés, quand |

### Coûts

| Coût | Durée |
|-----|-------|
| **Copier-coller des PDFs** | 30 min |
| **Implémentation parser** | 1h |
| **Injection Firestore** | 30 min |
| **Testing locker-tracker** | 30 min |
| **Documentation** | 15 min |
| **TOTAL** | **2h 45 min** |

### ROI : 🟢 Très positif (MVP enhancement, peu d'effort)

---

## 🗓️ Quand implémenter ?

**Recommandation** : Après Phase 3 (locker-tracker refactorisé).

**Raison** : 
1. locker-tracker doit être stable d'abord (Phase 3)
2. Import massif testé sur version finale
3. Après = "grand déploiement" avec vraies données

**Timeline** :
```
Phase 3: Refactoriser locker-tracker (1-2 semaines)
↓
Phase 3 validation: APK testée (1 semaine)
↓
Phase 3.5: DATA IMPORT — Importer 60 colis (2-3h)
↓
Grand déploiement: APK + vraies données (1 jour)
```

---

## 📝 Checklist d'implémentation

- [ ] Copier-coller le texte des 60 PDFs Gmail dans `colis-raw.txt`
- [ ] Mettre à jour la classe `CancelEmailParser` pour tous les transporteurs
- [ ] Tester parser sur 10 emails aléatoires (85%+ succès)
- [ ] Implémenter script d'import batch dans locker-tracker
- [ ] Tester import sur test collection Firestore
- [ ] Dédupliquer par numeroSuivi (si doublons)
- [ ] Importer dans production `meta/colis`
- [ ] Ouvrir locker-tracker, vérifier 60 colis affichés
- [ ] Tester filters (par transporteur, par statut)
- [ ] Documenter le résultat dans CHANGELOG

---

## 📞 Notes

**Q: Et les autres données dans les PDFs (SMS, scans de commande) ?**  
A: Hors scope. Focus sur les colis pour locker-tracker. SMS = future feature.

**Q: Supprimer les PDFs après import ?**  
A: Non, garder les archives dans `/mnt/project/` (historique).

**Q: Real-time tracking (réactualiser automatiquement) ?**  
A: Phase 5. Pour maintenant, données statiques du PDF = suffisant.

---

**Data import : Prêt pour Phase 3.5** 🚀
