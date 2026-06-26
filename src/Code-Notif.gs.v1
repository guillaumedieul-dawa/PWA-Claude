/**
 * FamilyHub — Code-Notif.gs
 * Envoi de notifications push FCM V1 via OAuth Apps Script
 * Appelé depuis Code-Tracker.gs quand un statut change
 */

var NOTIF_FB_PROJECT = 'familyhub-colis-8abbd';
var NOTIF_FCM_URL    = 'https://fcm.googleapis.com/v1/projects/' + NOTIF_FB_PROJECT + '/messages:send';
var NOTIF_FS_URL     = 'https://firestore.googleapis.com/v1/projects/' + NOTIF_FB_PROJECT + '/databases/(default)/documents/';
var NOTIF_API_KEY    = '';

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

  _notifLoadConfig();
  var tokens = _getFCMTokens();
  if (!tokens.length) {
    Logger.log('🔔 Pas de tokens FCM enregistrés');
    return;
  }

  var tpl    = NOTIF_TEMPLATES[newStatus];
  var carrier = pkg.carrier || 'Transporteur';
  var code    = pkg.pickupCode || '';
  var title   = tpl.emoji + ' ' + tpl.title;
  var body    = tpl.body
    .replace('{carrier}', carrier)
    .replace('{code}', code || pkg.lockerAddress || '');

  tokens.forEach(function(token) {
    try {
      _sendFCM(token, title, body, {
        status:  newStatus,
        carrier: carrier,
        fbId:    pkg._fbId || '',
        url:     '/locker-tracker/index.html',
        tag:     'fh-colis-' + (pkg._fbId || Date.now()),
      });
      Logger.log('🔔 Notif envoyée → ' + token.substring(0, 20) + '...');
    } catch(e) {
      Logger.log('❌ Notif error: ' + e.message);
    }
  });
}

// ── Lire les tokens FCM depuis Firestore ──────────────────────
function _getFCMTokens() {
  _notifLoadConfig();
  var accounts = ['Guillaume', 'Michele'];
  var tokens = [];

  accounts.forEach(function(acc) {
    try {
      var url = NOTIF_FS_URL + 'meta/fcmTokens/' + acc + '?key=' + NOTIF_API_KEY;
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) return;
      var data = JSON.parse(res.getContentText());
      var f = data.fields || {};
      if (f.token && f.token.stringValue) {
        tokens.push(f.token.stringValue);
        Logger.log('🔑 Token ' + acc + ' trouvé');
      }
    } catch(e) {
      Logger.log('❌ Token ' + acc + ': ' + e.message);
    }
  });

  return tokens;
}

// ── Envoi FCM V1 via OAuth ─────────────────────────────────────
function _sendFCM(token, title, body, data) {
  var oauthToken = ScriptApp.getOAuthToken();

  var message = {
    message: {
      token: token,
      notification: {
        title: title,
        body:  body,
      },
      data: data,
      android: {
        priority: 'HIGH',
        notification: {
          sound:        'default',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          channel_id:   'fh_colis',
        }
      },
      webpush: {
        headers: { Urgency: 'high' },
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

// ── Test manuel (exécuter depuis Apps Script pour tester) ──────
function testNotification() {
  _notifLoadConfig();
  var tokens = _getFCMTokens();
  Logger.log('Tokens trouvés: ' + tokens.length);

  if (!tokens.length) {
    Logger.log('❌ Aucun token — ouvre d\'abord locker-tracker dans l\'APK pour enregistrer le token');
    return;
  }

  sendStatusNotification({
    carrier:    'Colissimo',
    pickupCode: '4857',
    _fbId:      'test_notif',
  }, 'ready');

  Logger.log('✅ Notification test envoyée');
}

function _notifLoadConfig() {
  var props = PropertiesService.getScriptProperties();
  NOTIF_API_KEY = props.getProperty('FB_API_KEY') || NOTIF_API_KEY;
}
