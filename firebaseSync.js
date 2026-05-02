/**
 * firebaseSync.js — Bibliothèque centralisée Firebase pour FamilyHub v2
 * 
 * Élimine la duplication de code CRUD commune à toutes les sous-apps.
 * Tous les apps utilisent la même logique, seuls les noms de collections changent.
 * 
 * Version : 1.0.0
 * Date : 01/05/2026
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. CONFIGURATION FIREBASE (CENTRALISÉE)
// ────────────────────────────────────────────────────────────────────────────

const FB_PROJECT = 'familyhub-colis-8abbd';

/**
 * Récupère la clé API Firebase depuis localStorage
 * @returns {string} La clé API ou empty string
 */
function getFBKey() {
  try {
    const config = JSON.parse(localStorage.getItem('lt_fb'));
    return (config && config.apiKey) ? config.apiKey : '';
  } catch (e) {
    return '';
  }
}

/**
 * Construit l'URL Firestore complète pour une collection/document
 * @param {string} path - Chemin du document (ex: 'meta/todo/tasks/task-001')
 * @returns {string} URL Firestore avec clé API
 */
function fbUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/${path}?key=${getFBKey()}`;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. TRANSFORMATIONS DE CHAMPS (Field Conversion)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convertit un objet JavaScript → Format Firestore fields
 * Gère automatiquement null, boolean, number, string
 * 
 * @param {object} obj - Objet JavaScript
 * @param {string} numberType - 'integer' (défaut) ou 'double' pour les nombres
 * @returns {object} Objet au format Firestore {field: {type: value}}
 * 
 * @example
 * toFirestoreFields({title: 'Todo', done: false, count: 42})
 * // → {
 * //   title: {stringValue: 'Todo'},
 * //   done: {booleanValue: false},
 * //   count: {integerValue: '42'}
 * // }
 */
function toFirestoreFields(obj, numberType = 'integer') {
  const fields = {};
  
  for (const key in obj) {
    const value = obj[key];
    
    // Skip null/undefined
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    }
    // Boolean
    else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    }
    // Number
    else if (typeof value === 'number') {
      if (numberType === 'double') {
        fields[key] = { doubleValue: value };
      } else {
        fields[key] = { integerValue: String(value) };
      }
    }
    // String (défaut)
    else {
      fields[key] = { stringValue: String(value) };
    }
  }
  
  return fields;
}

/**
 * Convertit les fields Firestore → Objet JavaScript
 * @param {object} fields - Les fields d'un document Firestore
 * @returns {object} Objet JavaScript standard
 * 
 * @example
 * fromFirestoreFields({
 *   title: {stringValue: 'Todo'},
 *   done: {booleanValue: false},
 *   count: {integerValue: '42'}
 * })
 * // → {title: 'Todo', done: false, count: 42}
 */
function fromFirestoreFields(fields) {
  if (!fields) return {};
  
  const obj = {};
  
  for (const key in fields) {
    const field = fields[key];
    
    if ('stringValue' in field) {
      obj[key] = field.stringValue;
    } else if ('integerValue' in field) {
      obj[key] = parseInt(field.integerValue, 10);
    } else if ('doubleValue' in field) {
      obj[key] = field.doubleValue;
    } else if ('booleanValue' in field) {
      obj[key] = field.booleanValue;
    } else if ('nullValue' in field) {
      obj[key] = null;
    }
  }
  
  return obj;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. OPÉRATIONS CRUD GÉNÉRIQUES
// ────────────────────────────────────────────────────────────────────────────

/**
 * READ — Charge tous les documents d'une collection
 * @param {string} collection - Chemin collection (ex: 'meta/todo/tasks')
 * @returns {Promise<array>} Array d'objets JS ou null en cas d'erreur
 */
async function fbReadAll(collection) {
  const key = getFBKey();
  if (!key) {
    console.warn('fbReadAll: No Firebase key found');
    return null;
  }
  
  try {
    const url = fbUrl(collection);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`fbReadAll [${collection}]: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.documents) return [];
    
    // Transformer chaque document Firestore → JS
    return data.documents.map(doc => {
      const obj = fromFirestoreFields(doc.fields);
      obj.id = doc.name.split('/').pop(); // Extraire l'ID du path
      return obj;
    });
  } catch (error) {
    console.warn(`fbReadAll [${collection}]: ${error.message}`);
    return null;
  }
}

/**
 * CREATE/UPDATE — Écrit un document dans une collection
 * @param {string} collection - Chemin collection (ex: 'meta/todo/tasks')
 * @param {string} documentId - ID du document
 * @param {object} data - Objet à écrire
 * @param {object} options - {numberType: 'integer'|'double', excludeFields: []}
 * @returns {Promise<boolean>} true si succès, false sinon
 */
async function fbWrite(collection, documentId, data, options = {}) {
  const key = getFBKey();
  if (!key) {
    console.warn('fbWrite: No Firebase key found');
    return false;
  }
  
  try {
    const { numberType = 'integer', excludeFields = [] } = options;
    
    // Copie et exclusion de champs
    const dataToWrite = { ...data };
    excludeFields.forEach(field => delete dataToWrite[field]);
    
    const url = fbUrl(`${collection}/${documentId}`);
    const fields = toFirestoreFields(dataToWrite, numberType);
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    
    if (!response.ok) {
      console.warn(`fbWrite [${collection}/${documentId}]: ${response.status}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn(`fbWrite [${collection}]: ${error.message}`);
    return false;
  }
}

/**
 * DELETE — Supprime un document
 * @param {string} collection - Chemin collection
 * @param {string} documentId - ID du document
 * @returns {Promise<boolean>} true si succès
 */
async function fbDelete(collection, documentId) {
  const key = getFBKey();
  if (!key) {
    console.warn('fbDelete: No Firebase key found');
    return false;
  }
  
  try {
    const url = fbUrl(`${collection}/${documentId}`);
    
    const response = await fetch(url, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      console.warn(`fbDelete [${collection}/${documentId}]: ${response.status}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn(`fbDelete [${collection}]: ${error.message}`);
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. UTILITAIRES POUR LES SOUS-APPS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Crée un gestionnaire synchronisé pour une sous-app
 * Réduit la duplication en créant des wrappers typés par collection
 * 
 * @param {string} collection - Chemin collection (ex: 'meta/todo/tasks')
 * @param {object} options - {numberType: 'integer'|'double'}
 * @returns {object} {readAll, write, delete}
 * 
 * @example
 * const todoSync = fbCreateSyncHandler('meta/todo/tasks');
 * const tasks = await todoSync.readAll();
 * await todoSync.write('task-001', {title: 'Test', done: false});
 * await todoSync.delete('task-001');
 */
function fbCreateSyncHandler(collection, options = {}) {
  return {
    readAll: () => fbReadAll(collection),
    
    write: (documentId, data, writeOptions = {}) => 
      fbWrite(collection, documentId, data, { ...options, ...writeOptions }),
    
    delete: (documentId) => 
      fbDelete(collection, documentId),
    
    // Accessor pour la collection (si besoin de construire URLs custom)
    getCollection: () => collection,
    
    // Accessor pour construire URLs manuellement
    getUrl: (documentId) => fbUrl(`${collection}/${documentId}`)
  };
}

/**
 * Valide la configuration Firebase avant de faire des appels
 * @returns {boolean} true si la config est valide
 */
function fbIsConfigured() {
  try {
    const config = JSON.parse(localStorage.getItem('lt_fb'));
    return config && config.apiKey && config.projectId;
  } catch {
    return false;
  }
}

/**
 * Configure la clé Firebase (utile pour test/init)
 * @param {object} config - {apiKey, projectId, ...}
 */
function fbSetConfig(config) {
  localStorage.setItem('lt_fb', JSON.stringify(config));
}

/**
 * Récupère la config complète (pour debug)
 * @returns {object|null} La config ou null
 */
function fbGetConfig() {
  try {
    return JSON.parse(localStorage.getItem('lt_fb'));
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. EXPORT (Global ou Module)
// ────────────────────────────────────────────────────────────────────────────

// Si utilisé en tant que module ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Config
    getFBKey,
    fbUrl,
    fbSetConfig,
    fbGetConfig,
    fbIsConfigured,
    
    // Transformations
    toFirestoreFields,
    fromFirestoreFields,
    
    // CRUD
    fbReadAll,
    fbWrite,
    fbDelete,
    
    // Utilitaires
    fbCreateSyncHandler,
    
    // Exports pour compatibilité ancien code
    toFields: toFirestoreFields,
    fromFields: fromFirestoreFields
  };
}

// Si utilisé globalement dans <script>
if (typeof window !== 'undefined') {
  window.FBSync = {
    // Config
    getFBKey,
    fbUrl,
    fbSetConfig,
    fbGetConfig,
    fbIsConfigured,
    
    // Transformations
    toFirestoreFields,
    fromFirestoreFields,
    
    // CRUD
    fbReadAll,
    fbWrite,
    fbDelete,
    
    // Utilitaires
    fbCreateSyncHandler,
    
    // Aliases
    toFields: toFirestoreFields,
    fromFields: fromFirestoreFields
  };
  
  // Pour compatibilité immédiate (legacy)
  window.toFields = toFirestoreFields;
  window.fromFields = fromFirestoreFields;
  window.fbUrl = fbUrl;
  window.getFBKey = getFBKey;
}
