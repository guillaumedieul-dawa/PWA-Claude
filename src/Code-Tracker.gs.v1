/**
 * FamilyHub — Code-Tracker.gs
 * Phase 5 : Tracking automatique des colis via scraping lien de suivi
 * * Déploiement :
 * 1. Copier ce fichier dans un nouveau projet Apps Script
 * 2. Renseigner FB_PROJECT_ID et TRACKER_FB_API_KEY ci-dessous
 * 3. Déployer en tant que Web App (accès : "Moi uniquement")
 * 4. Créer un déclencheur horaire sur trackAllPackages()
 * 5. Copier l'URL de déploiement dans locker-tracker (champ TRACKER_WEBHOOK_URL)
 */

// ── Configuration ──────────────────────────────────────────────
var TRACKER_FB_PROJECT_ID = 'familyhub-colis-8abbd';
var TRACKER_FB_API_KEY    = '';  // Renseigner depuis Apps Script Properties
var TRACKER_FB_COLL       = 'colis';

// ── Point d'entrée Web App (appel depuis l'APK) ────────────────
function doGet(e) {
  var result = trackAllPackages();
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Trigger horaire principal ──────────────────────────────────
function trackAllPackages() {
  _loadConfig();

  var packages = _fetchActivePackages();
  var updated = 0, errors = 0, skipped = 0;

  packages.forEach(function(pkg) {
    if (!pkg.trackingLink && !pkg.trackingNum) { skipped++; return; }
    if (['collected', 'delivered'].indexOf(pkg.status) >= 0) { skipped++; return; }

    try {
      var result = _scrapePackage(pkg);
      if (result && result.changed) {
        _updateFirestore(pkg._fbId, result.fields);
        updated++;
        _log('✅ ' + pkg._fbId + ' → ' + result.fields.status);
        // Notification push si statut important
     
        try { sendStatusNotification(pkg, result.fields.status); } catch(e) { _log('notif: '+e.message); }
      }
    } catch(e) {
      errors++;
      _log('❌ ' + (pkg._fbId||'?') + ' : ' + e.message);
    }
    Utilities.sleep(800); // éviter le rate limiting
  });

  var summary = { updated: updated, errors: errors, skipped: skipped, total: packages.length, ts: new Date().toISOString() };
  _writeLog(summary);
  return summary;

}

// ── Chargement config depuis Properties ───────────────────────
function _loadConfig() {
  var props = PropertiesService.getScriptProperties();
  TRACKER_FB_API_KEY = props.getProperty('TRACKER_FB_API_KEY') || TRACKER_FB_API_KEY;

}

// ── Lire les colis actifs depuis Firestore ────────────────────
function _fetchActivePackages() {
  var url = _fbUrl(TRACKER_FB_COLL) + '&pageSize=200';

  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('Firestore read error: ' + res.getResponseCode());

  }
  var data = JSON.parse(res.getContentText());
  var docs = data.documents || [];

  return docs.map(function(doc) {
    var obj = _fromFields(doc.fields || {});
    obj._fbId = doc.name.split('/').pop();
    return obj;
  }).filter(function(p) {
    // Garder uniquement les colis actifs avec un lien ou numéro de suivi
    var active = ['pending', 'out_for_delivery', 'ready', 'failed'];
    return active.indexOf(p.status) >= 0 && (p.trackingLink || p.trackingNum);
  });

}

// ── Scraper un colis ──────────────────────────────────────────
function _scrapePackage(pkg) {
  var carrier = (pkg.carrier || '').toLowerCase();

  var url     = pkg.trackingLink || _buildTrackingUrl(carrier, pkg.trackingNum);
  if (!url) return null;

  var html = _fetchPage(url);

  if (!html) return null;

  var parsed = _parseStatus(carrier, html, pkg);
  if (!parsed) return null;

  // Vérifier si changement réel
  var changed = parsed.status !== pkg.status ||
                (parsed.lockerAddress && parsed.lockerAddress !== pkg.lockerAddress) ||

                (parsed.pickupCode    && parsed.pickupCode    !== pkg.pickupCode);

  if (!changed) return { changed: false };

  var fields = { status: parsed.status, lastUpdated: new Date().toISOString() };
  if (parsed.lockerAddress) fields.lockerAddress = parsed.lockerAddress;

  if (parsed.pickupCode)    fields.pickupCode    = parsed.pickupCode;

  if (parsed.expiryDate)    fields.expiryDate    = parsed.expiryDate;

  // Ajouter événement historique
  var events = [];

  try { events = JSON.parse(pkg.events || '[]'); } catch(e) {}
  if (!Array.isArray(events)) events = [];

  events.unshift({ date: new Date().toISOString(), status: parsed.status, desc: 'Scraping auto' });
  if (events.length > 10) events = events.slice(0, 10);

  fields.events = JSON.stringify(events);

  return { changed: true, fields: fields };

}

// ── Construction URL de suivi par transporteur ────────────────
function _buildTrackingUrl(carrier, num) {
  if (!num) return null;

  var URLS = {
    chronopost:   'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=' + num,
    chronofresh:  'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=' + num,
    colissimo:    'https://www.laposte.fr/outils/suivre-vos-envois?code=' + num,
    laposte:      'https://www.laposte.fr/outils/suivre-vos-envois?code=' + num,
    mondialrelay: 'https://www.mondialrelay.fr/suivi-de-colis/?NumColis=' + num,
    dpd:          'https://www.dpd.fr/trace/' + num,
    ups:          'https://www.ups.com/track?tracknum=' + num + '&loc=fr_FR',
    gls:          'https://gls-group.com/track/' + num,
 
    relaiscolis:  'https://www.relaiscolis.com/suivi-de-colis/?valeur=' + num,
    vintedgo:     'https://p.vintedgo.com/suivi?trackingNumber=' + num,
    amazon:       'https://track.amazon.fr/tracking/' + num,
  };

  return URLS[carrier] || null;
}

// ── Parsing HTML par transporteur ─────────────────────────────
function _parseStatus(carrier, html, pkg) {
  var lo = html.toLowerCase();

  var result = { status: pkg.status };

  // ── Détection statut générique (mots-clés FR) ─────────────
  if (_contains(lo, ['livré', 'remis au destinataire', 'distribué', 'delivered'])) {
    result.status = 'delivered';

  } else if (_contains(lo, ['en cours de livraison', 'en livraison', 'out for delivery', 'pris en charge par le livreur'])) {
    result.status = 'out_for_delivery';

  } else if (_contains(lo, ['disponible', 'à retirer', 'en attente de retrait', 'déposé', 'consigne'])) {
    result.status = 'ready';

  // Tenter d'extraire le code retrait
    var code = _extractCode(html);
    if (code) result.pickupCode = code;

    var addr = _extractAddress(html, carrier);
    if (addr) result.lockerAddress = addr;

  } else if (_contains(lo, ['incident', 'échec', 'avis de passage', 'absent', 'failed'])) {
    result.status = 'failed';

  } else if (_contains(lo, ['en transit', 'en cours d\'acheminement', 'expédié', 'pris en charge', 'pending'])) {
    result.status = 'pending';

  }

  // ── Overrides spécifiques par transporteur ─────────────────

  if (carrier === 'chronopost' || carrier === 'chronofresh') {
    if (_contains(lo, ['mis en instance', 'disponible en point de retrait'])) result.status = 'ready';

    if (_contains(lo, ['livraison en cours'])) result.status = 'out_for_delivery';
  }

  if (carrier === 'colissimo' || carrier === 'laposte') {
    if (_contains(lo, ['instance', 'boîte aux lettres'])) result.status = 'delivered';

    if (_contains(lo, ['disponible en bureau'])) result.status = 'ready';
  }

  if (carrier === 'mondialrelay') {
    if (_contains(lo, ['disponible en point relais'])) result.status = 'ready';

    var mrCode = html.match(/code\s*[:\-]?\s*(\d{4,8})/i);
    if (mrCode) result.pickupCode = mrCode[1];
    var mrAddr = html.match(/point relais\s*[:\-]?\s*([A-Z][^\n<]{5,60})/i);
    if (mrAddr) result.lockerAddress = mrAddr[1].trim();

  }

  if (carrier === 'dpd') {
    if (_contains(lo, ['parcel shop', 'relais'])) result.status = 'ready';

  }

  return result;
}

// ── Extraction code retrait ────────────────────────────────────
function _extractCode(html) {
  var patterns = [
    /code\s+d.ouverture\s*[:\-]?\s*(\d{4,8})/i,
    /code\s+de\s+retrait\s*[:\-]?\s*(\d{4,8})/i,
    /code\s*[:\-]\s*(\d{4,8})/i,
    /identifiant\s*[:\-]?\s*(\d{3,6})/i,
  ];

  for (var i = 0; i < patterns.length; i++) {
    var m = html.match(patterns[i]);

    if (m) return m[1];
  }
  return null;
}

// ── Extraction adresse ────────────────────────────────────────
function _extractAddress(html, carrier) {
  var patterns = [
    /consigne\s+pickup\s+([A-Z][^\n<]{5,60})/i,
    /point\s+relais\s*[:\-]?\s*([A-Z][^\n<]{5,60})/i,
    /disponible\s+(?:au|à)\s+([A-Z][^\n<]{5,60})/i,
  ];

  for (var i = 0; i < patterns.length; i++) {
    var m = html.match(patterns[i]);

    if (m) return m[1].trim();
  }
  return null;
}

// ── Fetch page HTML ───────────────────────────────────────────
function _fetchPage(url) {
  try {
    var options = {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      }
    };

    var res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() !== 200) return null;
    return res.getContentText();

  } catch(e) {
    _log('fetch error ' + url + ' : ' + e.message);
    return null;

  }
}

// ── Firestore helpers ─────────────────────────────────────────
function _fbUrl(path) {
  return 'https://firestore.googleapis.com/v1/projects/' + TRACKER_FB_PROJECT_ID +
    '/databases/(default)/documents/' + path + '?key=' + TRACKER_FB_API_KEY;

}

function _updateFirestore(docId, fields) {
  var url = _fbUrl(TRACKER_FB_COLL + '/' + docId);
  var body = { fields: _toFields(fields) };

  var options = {
    method: 'PATCH',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  };

  var res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
    throw new Error('Firestore write error: ' + res.getResponseCode() + ' ' + res.getContentText().substring(0, 100));

  }
}

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

// ── Logging ───────────────────────────────────────────────────
function _log(msg) {
  Logger.log(msg);

}

function _writeLog(summary) {
  try {
    var url = _fbUrl('meta/lastTrackerSync');

    var body = {
      fields: _toFields({
        log: summary.updated + ' mis à jour, ' + summary.errors + ' erreurs, ' + summary.skipped + ' ignorés sur ' + summary.total + ' — ' + summary.ts,
        ts:  summary.ts,
      })
    };

    UrlFetchApp.fetch(url, {
      method: 'PATCH',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });

  } catch(e) {}
}

// ── Utilitaires ───────────────────────────────────────────────
function _contains(str, keywords) {
  return keywords.some(function(k) { return str.indexOf(k) >= 0; });

}

// ── Setup initial (à exécuter une fois manuellement) ──────────
function setup() {
  // 1. Stocker l'API Key Firebase
  PropertiesService.getScriptProperties().setProperty('TRACKER_FB_API_KEY', 'REMPLACER_PAR_VOTRE_CLE');

  // 2. Créer le déclencheur horaire
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'trackAllPackages') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('trackAllPackages')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('✅ Setup terminé. Déclencheur horaire créé.');
}
