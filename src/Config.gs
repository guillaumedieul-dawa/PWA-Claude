/**
 * FamilyHub — Config.gs
 * Centralisation de la configuration Firebase et des utilitaires de conversion
 */

// ── Configuration Globale Firestore / FCM ─────────────────────
var FB_PROJECT_ID = 'familyhub-colis-8abbd';
var FB_API_KEY    = '';  // Chargé dynamiquement depuis les propriétés du script
var FB_COLL_COLIS = 'colis';

/**
 * Charge la configuration depuis les propriétés du script de manière unifiée
 */
function _loadGlobalConfig() {
  var props = PropertiesService.getScriptProperties();
  // Centralisation sur des clés de propriétés uniques et cohérentes
  FB_PROJECT_ID = props.getProperty('FIREBASE_PROJECT_ID') || FB_PROJECT_ID;
  FB_API_KEY    = props.getProperty('FIREBASE_API_KEY')    || props.getProperty('TRACKER_FB_API_KEY') || props.getProperty('FB_API_KEY') || FB_API_KEY;
}

/**
 * Génère l'URL de base pour les requêtes Firestore REST
 */
function _fbUrl(path) {
  _loadGlobalConfig();
  return 'https://firestore.googleapis.com/v1/projects/' + FB_PROJECT_ID +
    '/databases/(default)/documents/' + path + '?key=' + FB_API_KEY;
}

/**
 * Convertit un objet plat en structure de champs Firestore (Value Types)
 */
function _toFields(obj) {
  var f = {};
  Object.keys(obj).forEach(function(k) {
    var v = obj[k];
    if (v == null) return;
    if (typeof v === 'string')  f[k] = { stringValue: v };
    else if (typeof v === 'number')  f[k] = { doubleValue: v };
    else if (typeof v === 'boolean') f[k] = { booleanValue: v };
  });
  return f;
}

/**
 * Convertit une structure de champs Firestore en objet plat
 */
function _fromFields(fields) {
  var obj = {};
  Object.keys(fields).forEach(function(k) {
    var v = fields[k];
    if (v.stringValue  !== undefined) obj[k] = v.stringValue;
    else if (v.doubleValue  !== undefined) obj[k] = v.doubleValue;
    else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue, 10);
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else obj[k] = '';
  });
  return obj;
}
