// ═══════════════════════════════════════════════════
//  FamilyHub — Sync Gmail → Firebase (Optimisé v2.1)
//  Compte : Guillaume Dieul
//  V3
// ═══════════════════════════════════════════════════

const ACCOUNT_NAME = 'Guillaume';

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    // Correction de la valeur par défaut pour correspondre à la bdd réelle
    projectId: props.getProperty('FIREBASE_PROJECT_ID') || 'familyhub-colis-8abbd',
    apiKey: props.getProperty('FIREBASE_API_KEY') || 'CONFIGURE_API_KEY',
  };
}

// ── Détecteurs transporteurs ──
const CARRIERS = [
  { c: 'chronofresh', test: (f, s, b) => /chronofresh/i.test(f + s + b) },
  { c: 'colissimo', test: (f, s, b) => /colissimo/i.test(f + s + b) },
  { c: 'chronopost', test: (f, s, b) => /chronopost/i.test(f + s + b) },
  { c: 'mondialrelay', test: (f, s, b) => /mondial.?relay/i.test(f + s + b) },
  { c: 'vintedgo', test: (f, s, b) => /vinted/i.test(f + s + b) },
  { c: 'relaiscolis', test: (f, s, b) => /relais.?colis/i.test(f + s + b) },
  { c: 'dpd', test: (f, s, b) => /dpd/i.test(f + s + b) },
  { c: 'gls', test: (f, s, b) => /gls/i.test(f + s + b) },
  { c: 'ups', test: (f, s, b) => /ups/i.test(f + s + b) },
  { c: 'amazon', test: (f, s, b) => /amazon/i.test(f + s + b) }
];

function syncGmailToFirebase() {
  const config = getConfig();
  const trackingCache = fbGetExistingIds(config);
  
  const nowUnix = Math.floor(Date.now() / 1000);
  const oneDaySec = 24 * 3600;
  const startTimestamp = nowUnix - (7 * oneDaySec);
  
  const query = `(colis OR livraison OR suivi OR "mis à disposition" OR "prêt" OR "retirer") after:${startTimestamp}`;
  Logger.log('Query: ' + query);
  
  const threads = GmailApp.search(query, 0, 40);
  let newCount = 0;
  const batchWrites = [];

  threads.forEach(thread => {
    const msgs = thread.getMessages();
    msgs.forEach(msg => {
      const msgDateUnix = Math.floor(msg.getDate().getTime() / 1000);
      if (msgDateUnix < startTimestamp) return;

      const from = msg.getFrom();
      const subject = msg.getSubject();
      const body = msg.getPlainBody();

      const matchedCarrier = CARRIERS.find(car => car.test(from, subject, body));
      if (!matchedCarrier) return;

      const trackingNum = parseTrackingNum(matchedCarrier.c, subject, body);
      if (!trackingNum) return;

      const fbId = `${matchedCarrier.c}_${trackingNum}`;
      
      if (trackingCache[fbId]) {
        const currentStatus = trackingCache[fbId];
        if (currentStatus === 'delivered' || currentStatus === 'collected') return;
      }

      const status = parseStatus(body, subject);
      if (trackingCache[fbId] === status) return;

      const trackingLink = parseTrackingLink(body) || '';

      const packageData = {
        carrier: matchedCarrier.c,
        trackingNum: trackingNum,
        status: status,
        trackingLink: trackingLink,
        lastUpdated: new Date().toISOString()
      };

      batchWrites.push({ id: fbId, data: packageData });
      trackingCache[fbId] = status; 
      newCount++;
    });
  });

  if (batchWrites.length > 0) {
    fbBatchWrite(config, batchWrites);
  }
  
  _writeGmailLog(config, batchWrites.length);
}

function parseTrackingNum(carrier, subject, body) {
  const txt = subject + " " + body;
  let m;
  if (carrier === 'chronopost' || carrier === 'chronofresh' || carrier === 'colissimo') {
    m = txt.match(/[A-Z]{2}\d{9}[A-Z]{2}/i) || txt.match(/\b\d{13}\b/);
    return m ? m[0].toUpperCase() : null;
  }
  if (carrier === 'mondialrelay') {
    m = txt.match(/\b\d{8,12}\b/);
    return m ? m[0] : null;
  }
  if (carrier === 'vintedgo') {
    m = txt.match(/\bVGO\d{10,15}\b/i) || txt.match(/\b\d{10,15}\b/);
    return m ? m[0].toUpperCase() : null;
  }
  m = txt.match(/\b[A-Z0-9]{8,20}\b/i);
  return m ? m[0] : null;
}

function parseStatus(body, subject) {
  const txt = (subject + " " + body).toLowerCase();
  if (/livré|remis|distribué|delivered/i.test(txt)) return 'delivered';
  if (/disponible|retirer|instance|consigne|prêt/i.test(txt)) return 'ready';
  if (/en cours de livraison|livraison aujourd/i.test(txt)) return 'out_for_delivery';
  return 'pending';
}

function parseTrackingLink(body) {
  const m = body.match(/https?:\/\/[^\s"'<>]+/g);
  if (!m) return null;
  return m.find(url => /track|suivi|laposte|mondialrelay|chronopost|vintedgo/i.test(url)) || null;
}

function fbGetExistingIds(config) {
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/colis?key=${config.apiKey}&pageSize=300`;
  const cache = {};
  try {
    const res = UrlFetchApp.fetch(url, { method: 'GET', muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      if (data.documents) {
        data.documents.forEach(doc => {
          const id = doc.name.split('/').pop();
          const status = doc.fields && doc.fields.status ? doc.fields.status.stringValue : 'pending';
          cache[id] = status;
        });
      }
    }
  } catch (e) {
    Logger.log('Erreur cache : ' + e.toString());
  }
  return cache;
}

function fbBatchWrite(config, items) {
  items.forEach(item => {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/colis/${item.id}?key=${config.apiKey}`;
    const fields = {};
    for (const k in item.data) {
      fields[k] = { stringValue: String(item.data[k]) };
    }
    
    UrlFetchApp.fetch(url, {
      method: 'PATCH',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({ fields: fields })
    });
  });
}

function _writeGmailLog(config, newCount) {
  try {
    const logMsg = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
      + ' · ' + ACCOUNT_NAME + ' · ' + newCount + ' traité(s)';
    const logUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/meta/lastGmailSync?key=${config.apiKey}`;
    
    UrlFetchApp.fetch(logUrl, {
      method: 'PATCH',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        fields: {
          log: { stringValue: logMsg },
          account: { stringValue: ACCOUNT_NAME },
          newCount: { integerValue: newCount },
          updatedAt: { stringValue: new Date().toISOString() }
        }
      })
    });
  } catch (e) {
    Logger.log('Erreur log Firebase : ' + e.toString());
  }
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncGmailToFirebase') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('syncGmailToFirebase').timeBased().everyHours(1).create();
  Logger.log('Déclencheur installé : syncGmailToFirebase toutes les heures');
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncGmailToFirebase') {
      ScriptApp.deleteTrigger(t);
    }
  });
}
