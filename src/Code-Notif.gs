/**
 * FamilyHub — Code-Notif.gs
 * Envoi de notifications push FCM V1 via OAuth Apps Script
 */

var NOTIF_FCM_URL = '';
var NOTIF_FS_URL  = '';

// ── Statuts qui déclenchent une notification ───────────────────
var NOTIF_EVENTS = ['ready', 'out_for_delivery', 'delivered'];

// ── Templates de notification par statut ──────────────────────
var NOTIF_TEMPLATES = {
  ready:            { emoji: '📦', title: 'Colis à retirer !',         body: '{carrier} · Code : {code}' },
  out_for_delivery: { emoji: '🚚', title: 'En livraison aujourd\'hui', body: '{carrier} arrive aujourd\'hui' },
  delivered:        { emoji: '✅', title: 'Colis livré',               body: '{carrier} a été livré' },
};

// ── Point d'entrée : appelé depuis Code-Tracker.gs ───────────
function sendStatusNotification(pkg, newStatus) {
  if (NOTIF_EVENTS.indexOf(newStatus) < 0) return;

  _loadGlobalConfig();
  NOTIF_FCM_URL = 'https://fcm.googleapis.com/v1/projects/' + FB_PROJECT_ID + '/messages:send';
  NOTIF_FS_URL  = 'https://firestore.googleapis.com/v1/projects/' + FB_PROJECT_ID + '/databases/(default)/documents/';

  var tokens = _getFCMTokens();
  if (!tokens.length) return;

  var tpl = NOTIF_TEMPLATES[newStatus];
  var title = tpl.emoji + ' ' + tpl.title;
  var body  = tpl.body
    .replace('{carrier}', pkg.carrier || 'Colis')
    .replace('{code}', pkg.pickupCode || '-');

  var oauthToken = ScriptApp.getOAuthToken();
  var success = 0;

  tokens.forEach(function(tokenObj) {
    try {
      _sendToDevice(tokenObj.token, title, body, pkg, oauthToken);
      success++;
    } catch(e) {
      _log('fcm token error: ' + e.message);
    }
  });

  _log('📣 Notifications envoyées : ' + success + '/' + tokens.length);
}

// ── Récupérer les tokens FCM valides depuis Firestore ──────────
function _getFCMTokens() {
  var url = NOTIF_FS_URL + 'fcm_tokens?key=' + FB_API_KEY;
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return [];

  var data = JSON.parse(res.getContentText());
  var docs = data.documents || [];

  return docs.map(function(doc) {
    var f = doc.fields || {};
    return {
      token: f.token ? f.token.stringValue : '',
      updatedAt: f.updatedAt ? f.updatedAt.stringValue : ''
    };
  }).filter(function(t) { return t.token; });
}

// ── Envoi HTTP POST à l'API FCM V1 ────────────────────────────
function _sendToDevice(token, title, body, data, oauthToken) {
  var message = {
    message: {
      token: token,
      notification: { title: title, body: body },
      data: {
        status: data.status || '',
        carrier: data.carrier || '',
        trackingNum: data.trackingNum || '',
        fbId: data._fbId || ''
      },
      webpush: {
        notification: {
          title: title,
          body:  body,
          icon:  '/icons/home-192.png',
          badge: '/icons/home-192.png',
          tag:   data.tag || 'fh-notif',
          requireInteraction: data.status === 'ready',
          vibrate: [200, 100, 200],
        },
        fcm_options: { link: data.url || '/locker-tracker/index.html' }
      }
    }
  };

  var res = UrlFetchApp.fetch(NOTIF_FCM_URL, {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + oauthToken },
    payload: JSON.stringify(message),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('FCM V1 error ' + code + ': ' + res.getContentText().substring(0, 150));
  }
  return JSON.parse(res.getContentText());
}

// ── Test manuel ───────────────────────────────────────────────
function testNotification() {
  _loadGlobalConfig();
  NOTIF_FS_URL = 'https://firestore.googleapis.com/v1/projects/' + FB_PROJECT_ID + '/databases/(default)/documents/';
  var tokens = _getFCMTokens();
  Logger.log('Tokens trouvés: ' + tokens.length);

  if (!tokens.length) {
    Logger.log('❌ Aucun token — ouvre d\'abord locker-tracker dans l\'APK pour enregistrer le token');
    return;
  }
}
