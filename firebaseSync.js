/**
 * firebaseSync.js — Bibliothèque centralisée Firebase pour FamilyHub v2 (Optimisée)
 */

const FB_PROJECT = 'familyhub-colis-8abbd';

function getFBKey() {
  try {
    const config = JSON.parse(localStorage.getItem('lt_fb'));
    return (config && config.apiKey) ? config.apiKey : '';
  } catch {
    return '';
  }
}

function fbUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/${path}?key=${getFBKey()}`;
}

function toFirestoreFields(obj, numberType = 'integer') {
  const fields = {};
  for (const key in obj) {
    const value = obj[key];
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      fields[key] = numberType === 'double' ? { doubleValue: value } : { integerValue: String(value) };
    } else if (Array.isArray(value)) {
      fields[key] = { arrayValue: { values: value.map(v => toFirestoreFields({ temp: v }, numberType).temp) } };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: toFirestoreFields(value, numberType) } };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return fields;
}

function fromFirestoreFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const key in fields) {
    const field = fields[key];
    if ('stringValue' in field) obj[key] = field.stringValue;
    else if ('integerValue' in field) obj[key] = parseInt(field.integerValue, 10);
    else if ('doubleValue' in field) obj[key] = field.doubleValue;
    else if ('booleanValue' in field) obj[key] = field.booleanValue;
    else if ('nullValue' in field) obj[key] = null;
    else if ('arrayValue' in field) {
      const vals = field.arrayValue.values || [];
      obj[key] = vals.map(v => fromFirestoreFields({ temp: v }).temp);
    } else if ('mapValue' in field) {
      obj[key] = fromFirestoreFields(field.mapValue.fields);
    }
  }
  return obj;
}

async function fbReadAll(collection) {
  const key = getFBKey();
  if (!key) return JSON.parse(localStorage.getItem(`cache_${collection}`)) || null;
  
  try {
    const response = await fetch(fbUrl(collection));
    if (!response.ok) throw new Error(response.status);
    const data = await response.json();
    if (!data.documents) return [];
    
    const docs = data.documents.map(doc => {
      const obj = fromFirestoreFields(doc.fields);
      obj.id = doc.name.split('/').pop();
      return obj;
    });
    
    localStorage.setItem(`cache_${collection}`, JSON.stringify(docs));
    return docs;
  } catch (error) {
    console.warn(`fbReadAll offline fallback [${collection}]: ${error.message}`);
    return JSON.parse(localStorage.getItem(`cache_${collection}`)) || null;
  }
}

async function fbWrite(collection, documentId, data, options = {}) {
  const key = getFBKey();
  const { numberType = 'integer', excludeFields = [] } = options;
  const dataToWrite = { ...data };
  excludeFields.forEach(field => delete dataToWrite[field]);

  if (!key) {
    queueOfflineAction({ type: 'WRITE', collection, documentId, data: dataToWrite, options });
    return false;
  }
  
  try {
    const response = await fetch(fbUrl(`${collection}/${documentId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFirestoreFields(dataToWrite, numberType) })
    });
    return response.ok;
  } catch {
    queueOfflineAction({ type: 'WRITE', collection, documentId, data: dataToWrite, options });
    return false;
  }
}

async function fbDelete(collection, documentId) {
  const key = getFBKey();
  if (!key) {
    queueOfflineAction({ type: 'DELETE', collection, documentId });
    return false;
  }
  try {
    const response = await fetch(fbUrl(`${collection}/${documentId}`), { method: 'DELETE' });
    return response.ok;
  } catch {
    queueOfflineAction({ type: 'DELETE', collection, documentId });
    return false;
  }
}

function queueOfflineAction(action) {
  const queue = JSON.parse(localStorage.getItem('fb_offline_queue')) || [];
  queue.push({ ...action, timestamp: Date.now() });
  localStorage.setItem('fb_offline_queue', JSON.stringify(queue));
}

function fbCreateSyncHandler(collection, options = {}) {
  return {
    readAll: () => fbReadAll(collection),
    write: (documentId, data, writeOptions = {}) => fbWrite(collection, documentId, data, { ...options, ...writeOptions }),
    delete: (documentId) => fbDelete(collection, documentId),
    getCollection: () => collection,
    getUrl: (documentId) => fbUrl(`${collection}/${documentId}`)
  };
}

function fbIsConfigured() {
  try {
    const config = JSON.parse(localStorage.getItem('lt_fb'));
    return !!(config && config.apiKey && config.projectId);
  } catch {
    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getFBKey, fbUrl, toFirestoreFields, fromFirestoreFields, fbReadAll, fbWrite, fbDelete, fbCreateSyncHandler, fbIsConfigured };
}
if (typeof window !== 'undefined') {
  window.FBSync = { getFBKey, fbUrl, toFirestoreFields, fromFirestoreFields, fbReadAll, fbWrite, fbDelete, fbCreateSyncHandler, fbIsConfigured };
}
