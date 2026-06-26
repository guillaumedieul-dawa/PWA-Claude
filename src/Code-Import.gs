/**
 * FamilyHub — Code-Import.gs
 * Phase 3.5 : Import historique emails colis Gmail → Firestore
 */

var IMPORT_MAX_EMAILS    = 200;   // Max emails à lire par run
var IMPORT_DAYS_BACK     = 365;   // Chercher sur les 12 derniers mois

// ── Fonction principale ────────────────────────────────────────
function importGmailColis() {
  _loadGlobalConfig();

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
        
        var carrier = _detectCarrier(from, subject, body);
        if (!carrier) return;

        var num = _extractTrackingNum(carrier, subject, body);
        if (!num) return;

        if (seen[num]) return;
        seen[num] = true;

        var status = _determineStatus(subject, body);
        var link = _extractTrackingLink(body);

        var pkg = {
          carrier: carrier,
          trackingNum: num,
          status: status,
          trackingLink: link || '',
          events: JSON.stringify([{ date: new Date(msg.getDate()).toISOString(), status: status, desc: 'Import historique Gmail' }]),
          lastUpdated: new Date().toISOString()
        };

        var fbId = carrier + '_' + num;
        var res = _upsertPackage(fbId, pkg);
        if (res === 'created') imported++;
        else if (res === 'updated') updated++;
        else skipped++;

      } catch(e) {
        errors++;
        Logger.log('Erreur msg: ' + e.message);
      }
    });
  });

  var summary = { imported: imported, updated: updated, skipped: skipped, errors: errors, total: threads.length };
  _importWriteLog(summary);
}

// ── Upsert Firestore ──────────────────────────────────────────
function _upsertPackage(fbId, pkg) {
  var url = _fbUrl(FB_COLL_COLIS + '/' + fbId);
  
  var check = UrlFetchApp.fetch(url, { method: 'GET', muteHttpExceptions: true });
  var isNew = (check.getResponseCode() === 404);

  if (!isNew) {
    try {
      var exDoc = JSON.parse(check.getContentText());
      var exStatus = exDoc.fields.status ? exDoc.fields.status.stringValue : 'pending';
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

  UrlFetchApp.fetch(url, {
    method: 'PATCH',
    contentType: 'application/json',
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true,
  });

  return isNew ? 'created' : 'updated';
}

function _importWriteLog(summary) {
  try {
    var url = _fbUrl('meta/lastGmailImport');
    var body = {
      fields: _toFields({
        log: summary.imported + ' créés, ' + summary.updated + ' mis à jour, ' + summary.skipped + ' ignorés — ' + new Date().toISOString(),
        ts:  new Date().toISOString()
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

// ── Recherche & Extraction ────────────────────────────────────
function _buildGmailQuery() {
  var keywords = ['suivi', 'colis', 'livraison', 'chronopost', 'colissimo', 'mondial relay', 'relais colis', 'vinted go', 'dpd', 'gls', 'amazon'];
  var q = '(' + keywords.join(' OR ') + ')';
  
  var d = new Date();
  d.setDate(d.getDate() - IMPORT_DAYS_BACK);
  var after = d.getFullYear() + '/' + (d.getMonth()+1) + '/' + d.getDate();
  
  return q + ' after:' + after;
}

function _detectCarrier(from, subj, body) {
  var all = from + ' ' + subj + ' ' + body;
  all = all.toLowerCase();
  if (all.indexOf('chronopost') >= 0) return 'chronopost';
  if (all.indexOf('colissimo') >= 0 || all.indexOf('la poste') >= 0) return 'colissimo';
  if (all.indexOf('mondial relay') >= 0) return 'mondialrelay';
  if (all.indexOf('relais colis') >= 0) return 'relaiscolis';
  if (all.indexOf('vinted go') >= 0) return 'vintedgo';
  if (all.indexOf('dpd') >= 0) return 'dpd';
  if (all.indexOf('gls') >= 0) return 'gls';
  if (all.indexOf('amazon') >= 0) return 'amazon';
  return null;
}

/**
 * Extraction simplifiée du numéro de suivi
 */
function _extractTrackingNum(carrier, subj, body) {
  var text = subj + ' ' + body;
  var m;
  if (carrier === 'chronopost' || carrier === 'colissimo') {
    m = text.match(/[A-Z]{2}\d{9}[A-Z]{2}/) || text.match(/\b\d{13}\b/);
    if (m) return m[0];
  }
  if (carrier === 'mondialrelay') {
    m = text.match(/\b\d{8,12}\b/);
    if (m) return m[0];
  }
  m = text.match(/\b[A-Z0-9]{8,18}\b/);
  return m ? m[0] : null;
}

function _determineStatus(subj, body) {
  var txt = (subj + ' ' + body).toLowerCase();
  if (txt.indexOf('livré') >= 0 || txt.indexOf('remis') >= 0) return 'delivered';
  if (txt.indexOf('disponible') >= 0 || txt.indexOf('retirer') >= 0 || txt.indexOf('instance') >= 0) return 'ready';
  if (txt.indexOf('cours de livraison') >= 0) return 'out_for_delivery';
  return 'pending';
}

function _extractTrackingLink(body) {
  var m = body.match(/https?:\/\/[^\s"'<>]+/g);
  if (!m) return null;
  for (var i=0; i<m.length; i++) {
    if (m[i].indexOf('track') >= 0 || m[i].indexOf('suivi') >= 0 || m[i].indexOf('laposte') >= 0 || m[i].indexOf('mondialrelay') >= 0) {
      return m[i];
    }
  }
  return null;
}
