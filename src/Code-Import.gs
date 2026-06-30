/**
 * FamilyHub — Code-Import.gs
 * Phase 3.5 : Import historique emails colis Gmail → Firestore
 * FIX CRITIQUE : _importWriteFirestore() ajoute updateMask.fieldPaths
 *   sur le PATCH (même bug que Code-Tracker.gs — sans ce paramètre,
 *   Firestore remplace tout le document par les seuls champs envoyés).
 *
 * Utilisation :
 *   1. Coller ce fichier dans le projet Apps Script existant
 *   2. Exécuter importGmailColis() une fois manuellement
 *   3. Vérifier les logs → colis importés dans Firestore
 */

// ── Configuration ──────────────────────────────────────────────
var IMPORT_FB_PROJECT_ID = 'familyhub-colis-8abbd';
var IMPORT_FB_API_KEY    = '';
var IMPORT_FB_COLL       = 'colis';
var IMPORT_MAX_EMAILS    = 200;   // Max emails à lire par run
var IMPORT_DAYS_BACK     = 365;   // Chercher sur les 12 derniers mois

// ── Fonction principale ────────────────────────────────────────
function importGmailColis() {
  _importLoadConfig();

  var query = _buildGmailQuery();
  Logger.log('🔍 Recherche Gmail : ' + query);

  var threads = GmailApp.search(query, 0, IMPORT_MAX_EMAILS);
  Logger.log('📧 ' + threads.length + ' fils trouvés');

  var imported = 0, updated = 0, skipped = 0, errors = 0;
  var seen = {}; // déduplication par trackingNum

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    messages.forEach(function(msg) {
      try {
        var subject = msg.getSubject() || '';
        var body    = msg.getPlainBody() || '';
        var from    = msg.getFrom() || '';
        var date    = msg.getDate();

        var pkg = _parseEmail(subject, body, from, date, msg.getId());
        if (!pkg) { skipped++; return; }

        // Déduplication locale
        var key = pkg.trackingNum || pkg.pickupCode || pkg.gmailMsgId;
        if (seen[key]) {
          // Garder le statut le plus avancé
          var O = {pending:0, out_for_delivery:1, ready:2, failed:2, delivered:3, collected:4};
          if ((O[pkg.status]||0) > (O[seen[key].status]||0)) {
            seen[key].status = pkg.status;
          }
          skipped++;
          return;
        }
        seen[key] = pkg;

        // Écrire dans Firestore
        var result = _importWriteFirestore(pkg);
        if (result === 'created') imported++;
        else if (result === 'updated') updated++;

      } catch(e) {
        errors++;
        Logger.log('❌ Erreur email : ' + e.message);
      }
    });
  });

  var summary = '✅ Import terminé : ' + imported + ' créés, ' + updated + ' mis à jour, ' + skipped + ' ignorés, ' + errors + ' erreurs sur ' + threads.length + ' fils';
  Logger.log(summary);
  _importWriteLog(summary);
  return summary;
}

// ── Construction requête Gmail ─────────────────────────────────
function _buildGmailQuery() {
  var carriers = [
    'chronopost', 'colissimo', 'mondial relay', 'dpd', 'ups', 'gls',
    'vinted', 'amazon', 'laposte', 'la poste', 'pickup', 'relais colis',
    'too good to go', 'chronofresh'
  ];
  var subjects = [
    'colis', 'suivi', 'livraison', 'tracking', 'expédié', 'disponible',
    'retrait', 'livré', 'delivery', 'shipped', 'package'
  ];

  var after = new Date();
  after.setDate(after.getDate() - IMPORT_DAYS_BACK);
  var dateStr = after.getFullYear() + '/' + String(after.getMonth()+1).padStart(2,'0') + '/' + String(after.getDate()).padStart(2,'0');

  var carrierQ = '(' + carriers.map(function(c) { return 'from:' + c.replace(' ', '*'); }).join(' OR ') + ')';
  var subjectQ = '(' + subjects.map(function(s) { return 'subject:' + s; }).join(' OR ') + ')';

  return subjectQ + ' after:' + dateStr;
}

// ── Parsing email → objet colis ────────────────────────────────
function _parseEmail(subject, body, from, date, msgId) {
  var text = subject + '\n' + body;
  var lo   = text.toLowerCase();
  var fromLo = from.toLowerCase();

  // Détection transporteur
  var carrier = _detectCarrier(fromLo, lo);
  if (!carrier) return null;

  // Extraction des champs
  var trackingNum  = _xTrackingNum(carrier, text);
  var pickupCode   = _xPickupCode(text);
  var lockerAddr   = _xAddress(text);
  var trackingLink = _xLink(text);
  var status       = _xStatus(lo);
  var sender       = _xSender(text, from);

  // Ignorer si rien d'utile
  if (!trackingNum && !pickupCode && !lockerAddr) return null;

  var dateISO  = date ? date.toISOString() : new Date().toISOString();
  var fbId     = 'gmail_' + msgId;

  return {
    id:           fbId,
    _fbId:        fbId,
    carrier:      carrier,
    trackingNum:  trackingNum  || '',
    pickupCode:   pickupCode   || '',
    lockerAddress:lockerAddr   || '',
    trackingLink: trackingLink || '',
    sender:       sender       || '',
    status:       status,
    arrivalDate:  dateISO,
    lastUpdated:  dateISO,
    expiryDate:   _xExpiry(text, dateISO, carrier),
    emailSubject: subject.substring(0, 120),
    gmailMsgId:   msgId,
    gmailLink:    'https://mail.google.com/mail/u/0/#inbox/' + msgId,
    account:      'Guillaume',
    source:       'gmail_import',
    note:         '',
    events:       JSON.stringify([{date: dateISO, status: status, desc: 'Import Gmail'}]),
  };
}

// ── Détection transporteur ─────────────────────────────────────
function _detectCarrier(fromLo, textLo) {
  if (/chronofresh/i.test(fromLo + textLo)) return 'chronofresh';
  if (/colissimo/i.test(fromLo + textLo) || /laposte\.fr/i.test(fromLo)) return 'colissimo';
  if (/chronopost/i.test(fromLo + textLo) || /pickup\.fr/i.test(fromLo)) return 'chronopost';
  if (/mondial.?relay/i.test(fromLo + textLo)) return 'mondialrelay';
  if (/vinted/i.test(fromLo + textLo)) return 'vintedgo';
  if (/relais.?colis/i.test(fromLo + textLo)) return 'relaiscolis';
  if (/\bdpd\b/i.test(fromLo + textLo)) return 'dpd';
  if (/\bups\b/i.test(fromLo + textLo)) return 'ups';
  if (/\bgls\b/i.test(fromLo + textLo)) return 'gls';
  if (/too.?good.?to.?go/i.test(fromLo + textLo)) return 'chronopost';
  if (/amazon/i.test(fromLo + textLo)) return 'amazon';
  if (/la.?poste/i.test(fromLo + textLo)) return 'laposte';
  return null;
}

// ── Extraction numéro de suivi ─────────────────────────────────
function _xTrackingNum(carrier, text) {
  var patterns = {
    ups:          [/\b(1Z[A-Z0-9]{16})\b/i],
    chronopost:   [/\b([A-Z]{2}\d{9}[A-Z]{2})\b/, /\b(PP\d{9}FR)\b/i, /\b(\d{13}[A-Z])\b/],
    chronofresh:  [/\b([A-Z]{2}\d{9}[A-Z]{2})\b/],
    colissimo:    [/\b(6[A-Z]\d{11})\b/, /\b(8[A-Z]\d{11})\b/, /n[°o]\s*([A-Z0-9]{9,15})\b/i],
    laposte:      [/\b(6[A-Z]\d{11})\b/, /\b(8[A-Z]\d{11})\b/],
    mondialrelay: [/\b(\d{8})\b/],
    vintedgo:     [/\b(1UW[A-Z0-9]{9,})\b/i, /\b(\d{13,19})\b/],
    dpd:          [/\b(\d{14})\b/],
    gls:          [/colis\s+([0-9A-Z]{6,10})\b/i],
    relaiscolis:  [/\b(VD[A-Z0-9]{8,})\b/i],
    amazon:       [/\b(\d{3}-\d{7}-\d{7})\b/],
  };
  var list = patterns[carrier] || [];
  for (var i = 0; i < list.length; i++) {
    var m = text.match(list[i]);
    if (m && m[1]) return m[1].toUpperCase().trim();
  }
  return '';
}

// ── Extraction code retrait ────────────────────────────────────
function _xPickupCode(text) {
  var patterns = [
    /identifiant\s*[:\-]\s*(\d{3,6})[\s\S]*?(?:code\s+d.ouverture)\s*[:\-]\s*(\d{3,6})/i,
    /code\s+d.ouverture\s*[:\-]?\s*(\d{4,8})/i,
    /code\s+de\s+retrait\s*[:\-]?\s*(\d{4,8})/i,
    /contre\s+code\s+(\d{4,8})/i,
    /\bCODE\s+(\d{4,8})\b/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) return m[2] ? m[1] + ' / ' + m[2] : m[1];
  }
  return '';
}

// ── Extraction adresse retrait ─────────────────────────────────
function _xAddress(text) {
  var patterns = [
    /consigne\s+pickup\s+(.+?)(?:\.|jusqu|code|\n)/i,
    /point\s+relais\s*[:\-]?\s*([A-Z][^\n.]{5,60})/i,
    /disponible\s+(?:au|à)\s+([A-Z][^\n.]{5,60})/i,
    /Expédier à\s*\n([\s\S]{10,100}?)(?:\n\n)/i,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m && m[1] && m[1].trim().length > 4) return m[1].trim().substring(0, 150);
  }
  return '';
}

// ── Extraction lien de suivi ───────────────────────────────────
function _xLink(text) {
  var patterns = [
    /https?:\/\/(?:www\.)?chronopost\.fr\/tracking[^\s<"')]+/i,
    /https?:\/\/(?:www\.)?laposte\.fr\/outils\/suivre[^\s<"')]+/i,
    /https?:\/\/(?:www\.)?mondialrelay\.fr\/suivi[^\s<"')]+/i,
    /https?:\/\/(?:www\.)?dpd\.fr\/trace[^\s<"')]+/i,
    /https?:\/\/[^\s<"')]{12,80}/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) return m[0];
  }
  return '';
}

// ── Détection statut ───────────────────────────────────────────
function _xStatus(lo) {
  if (/livré|remis au destinataire|distribué|delivered|boîte aux lettres/.test(lo)) return 'delivered';
  if (/en cours de livraison|en livraison|out for delivery/.test(lo)) return 'out_for_delivery';
  if (/disponible|à retirer|en attente de retrait|consigne|relais/.test(lo)) return 'ready';
  if (/incident|échec|avis de passage|absent|failed/.test(lo)) return 'failed';
  return 'pending';
}

// ── Extraction expéditeur ──────────────────────────────────────
function _xSender(text, from) {
  var m = text.match(/expédié\s+par\s+([A-Z][^\n.]{2,40}?)(?:\n|\.|est)/i);
  if (m) return m[1].trim();
  // Nettoyer le champ "from"
  return from.replace(/<.*>/, '').replace(/"/g, '').trim().substring(0, 40);
}

// ── Calcul date d'expiration ───────────────────────────────────
function _xExpiry(text, arrivalISO, carrier) {
  var defaults = {chronopost:8,chronofresh:5,mondialrelay:5,colissimo:15,laposte:15,vintedgo:14,amazon:3,dpd:14,ups:10,gls:7,relaiscolis:10};
  var d = text.match(/disposez?\s+de\s+(\d+)\s+jours?/i);
  if (d) {
    var x = new Date(arrivalISO);
    x.setDate(x.getDate() + parseInt(d[1]));
    return x.toISOString().split('T')[0];
  }
  var days = defaults[carrier] || 14;
  var def = new Date(arrivalISO);
  def.setDate(def.getDate() + days);
  return def.toISOString().split('T')[0];
}

// ── Écriture Firestore ─────────────────────────────────────────
// FIX CRITIQUE : updateMask.fieldPaths ajouté sur la requête PATCH
// (distincte de l'URL de lecture "url" utilisée pour le check d'existence).
function _importWriteFirestore(pkg) {
  _importLoadConfig();
  var url = 'https://firestore.googleapis.com/v1/projects/' + IMPORT_FB_PROJECT_ID +
    '/databases/(default)/documents/' + IMPORT_FB_COLL + '/' + pkg._fbId +
    '?key=' + IMPORT_FB_API_KEY;

  // Vérifier si existe déjà
  var check = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var isNew = check.getResponseCode() === 404;

  // Si existe avec statut plus avancé → skip
  if (!isNew) {
    try {
      var existing = JSON.parse(check.getContentText());
      var exFields = existing.fields || {};
      var exStatus = exFields.status && exFields.status.stringValue || '';
      var O = {pending:0,out_for_delivery:1,ready:2,failed:2,delivered:3,collected:4};
      if ((O[exStatus]||0) >= (O[pkg.status]||0)) return 'skipped';
    } catch(e) {}
  }

  var fields = {};
  Object.keys(pkg).forEach(function(k) {
    if (k === '_fbId') return;
    var v = pkg[k];
    if (v == null || v === '') return;
    if (typeof v === 'string')  fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = { doubleValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
  });

  // updateMask = exactement les clés présentes dans "fields" (écriture partielle sûre)
  var patchUrl = url;
  Object.keys(fields).forEach(function(k) {
    patchUrl += '&updateMask.fieldPaths=' + encodeURIComponent(k);
  });

  UrlFetchApp.fetch(patchUrl, {
    method: 'PATCH',
    contentType: 'application/json',
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true,
  });

  return isNew ? 'created' : 'updated';
}

// ── Config & logs ──────────────────────────────────────────────
function _importLoadConfig() {
  var props = PropertiesService.getScriptProperties();
  IMPORT_FB_API_KEY = props.getProperty('FB_API_KEY') || IMPORT_FB_API_KEY;
}

function _importWriteLog(summary) {
  try {
    var url = 'https://firestore.googleapis.com/v1/projects/' + IMPORT_FB_PROJECT_ID +
      '/databases/(default)/documents/meta/lastGmailImport?key=' + IMPORT_FB_API_KEY +
      '&updateMask.fieldPaths=log&updateMask.fieldPaths=ts';
    UrlFetchApp.fetch(url, {
      method: 'PATCH',
      contentType: 'application/json',
      payload: JSON.stringify({ fields: {
        log: { stringValue: summary },
        ts:  { stringValue: new Date().toISOString() },
      }}),
      muteHttpExceptions: true,
    });
  } catch(e) {}
}
