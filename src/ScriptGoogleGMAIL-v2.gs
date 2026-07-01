// ═══════════════════════════════════════════════════
//  FamilyHub — Sync Gmail → Firebase (Optimisé v2.2)
//  Compte : Guillaume Dieul.
//  V3
//  FIX CRITIQUE v2.2 : ajout de updateMask sur les writes batch
//  (:commit). Sans ce champ, chaque "update" REMPLACE le document
//  entier par les seuls champs du batch et efface silencieusement
//  carrier/trackingNum/pickupCode/note/etc. sur tout colis déjà
//  enrichi manuellement ou par un autre import.
//  Optimisations : Filtre temporel précis (Unix timestamp), suppression de l'appel fbGetExistingIds lourd
// ═══════════════════════════════════════════════════

const ACCOUNT_NAME = 'Guillaume';

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    projectId: props.getProperty('FIREBASE_PROJECT') || 'familyhub-colis',
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
  { c: 'amazon', test: (f, s, b) => /amazon/i.test(f + s + b) && !/chronopost|mondial/i.test(f + s) },
  { c: 'dpd', test: (f, s, b) => /\bdpd\b/i.test(f + s + b) },
  { c: 'ups', test: (f, s, b) => /\bups\b/i.test(f + s + b) },
  { c: 'gls', test: (f, s, b) => /\bgls\b/i.test(f + s + b) },
  { c: 'laposte', test: (f, s, b) => /la.?poste/i.test(f + s + b) },
];

// ── Statuts ──
const STATUS_MAP = {
  delivered: ['a été livré', 'livraison effectuée', 'remis à', 'colis livré', 'livré le'],
  expired: ["retourné à l'expéditeur", 'non récupéré', 'délai dépassé'],
  failed: ['tentative de livraison échouée', 'absent lors de la livraison', "n'a pas pu être livré"],
  out_for_delivery: ['est en cours de livraison', 'chauffeur vous le livrera', "livré aujourd'hui", "arrive aujourd'hui", 'programmé en livraison'],
  ready: ['disponible en consigne', 'à retirer', 'vos codes', 'code de retrait', 'est disponible', 'déposé dans', 'retire ton colis', 'est arrivé', 'retirez-le vite', 'contre remise du code', 'présentez le code'],
  pending: ['en chemin', 'en route', 'sera livré', 'expédié', 'pris en charge', 'acheminé', 'confié par'],
};

function detectStatus(t) {
  if (!t) return 'pending';
  const lo = t.toLowerCase();
  const ORDER = ['delivered', 'expired', 'failed', 'out_for_delivery', 'ready', 'pending'];
  for (const s of ORDER) {
    if (STATUS_MAP[s].some(k => lo.includes(k))) return s;
  }
  return 'pending';
}

function extractTracking(c, t) {
  if (!t) return '';
  const P = {
    ups: [/\b(1Z[A-Z0-9]{16})\b/i],
    chronopost: [/\b([A-Z]{2}\d{9}[A-Z]{2})\b/, /\b(PP\d{9}FR)\b/i, /\b(\d{13}[A-Z])\b/],
    chronofresh: [/\b([A-Z]{2}\d{9}[A-Z]{2})\b/],
    colissimo: [/\b(6[A-Z]\d{11})\b/, /\b(8[A-Z]\d{11})\b/, /\b(9V\d{11})\b/, /\b(7M\d{11})\b/, /\b(\d{13})\b/, /\bn[°o]\s*([A-Z0-9]{9,15})\b/i],
    mondialrelay: [/\b(\d{8})\b/, /\b(\d{5,7})\b/],
    vintedgo: [/\b(1UW[A-Z0-9]{9,})\b/i, /\b(\d{13,19})\b/],
    dpd: [/\b(\d{14})\b/, /colis n[°o]\s*(\d{10,})/i],
    gls: [/colis\s+([0-9A-Z]{6,10})\b/i],
    relaiscolis: [/\b(VD[A-Z0-9]{8,})\b/i],
    laposte: [/\b(6[A-Z]\d{11})\b/, /\b(8[A-Z]\d{11})\b/, /\b(\d{13})\b/],
    amazon: [/\b(\d{3}-\d{7}-\d{7})\b/],
  };
  for (const re of (P[c] || [])) {
    const m = t.match(re);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return '';
}

function extractCode(t) {
  if (!t) return '';
  const m1 = t.match(/(?:vos\s+)?codes?\s+(\d{4})\s+puis\s+(\d{4})/i);
  if (m1) return m1[1] + ' / ' + m1[2];
  const m2 = t.match(/identifiant\s*:\s*(\d{3,8}).*?code\s*d.ouverture\s*:\s*(\d{3,8})/is);
  if (m2) return m2[1] + ' / ' + m2[2];
  const m3 = t.match(/\bCODE\s+(\d{4,8})\b/);
  if (m3) return m3[1];
  const m9 = t.match(/communiquez\s+lui\s+le\s+code[\s\n]+(\d{4,8})/i);
  if (m9) return m9[1];
  const ma = t.match(/(?:présentez\s+(?:ce\s+)?(?:QR\s+)?code[^\n]*\n\s*)(\d{4,8})/i);
  if (ma) return ma[1];
  const m4 = t.match(/contre\s+(?:remise\s+du\s+)?code\s+(\d{4,8})/i);
  if (m4) return m4[1];
  const m5 = t.match(/code\s+de\s+retrait\s+(\d{4,8})/i);
  if (m5) return m5[1];
  const m6 = t.match(/\bcode\s*:\s*([A-Z0-9\-]{3,12})/i);
  if (m6) return m6[1];
  const m7 = t.match(/présentez\s+le\s+code\s+(\d{4,8})/i);
  if (m7) return m7[1];
  const m8 = t.match(/\b(?:code\s+consigne|code\s+amazon)\s*:\s*(\d{6})\b/i);
  if (m8) return m8[1];
  return '';
}

function extractAddress(t) {
  if (!t) return '';
  const P = [
    /consigne\s+pickup\s+(.+?)(?:\.|jusqu|n°|code|\+\s*d)/i,
    /consigne\s+vinted\s+go\s*:\s*(.+?)(?:\.|suivi)/i,
    /(?:au\s+)?(?:p\.\s*)?relais\s+([A-Z][A-Z\s]{3,40}?)(?:\.|retirez|avec|$)/i,
    /disponible\s+au\s+(.+?)(?:\.|retirez|avec|$)/i,
    /votre\s+point\s+de\s+retrait\s*:\s*\n*(.+?\n?.+?\n?.+?)(?:\n\n)/is,
    /sera\s+livré\s+à\s*\n(.+?\n?.+?)(?:\n\n|france)/is,
    /expédier\s+à\s*\n(.+?\n?.+?\n?.+?)(?:\n\n|ups standard)/is,
  ];
  for (const re of P) {
    const m = t.match(re);
    if (m?.[1]) {
      const lines = m[1].split('\n').map(l => l.trim()).filter(l => l.length > 2);
      if (lines.length) return lines.slice(0, 3).join(', ').substring(0, 150);
    }
  }
  return '';
}

function extractDeliverySlot(t) {
  if (!t) return '';
  const m1 = t.match(/entre\s+(\d{1,2}[h:]\d{2})\s*[-–et]+\s*(\d{1,2}[h:]\d{2})/i);
  if (m1) return m1[1].replace('h', ':') + ' — ' + m1[2].replace('h', ':');
  return '';
}

function toFirestoreFields(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') {
      fields[k] = Number.isInteger(v) ? { integerValue: v } : { doubleValue: v };
    }
  }
  return fields;
}

// FIX CRITIQUE : chaque write porte désormais son propre updateMask
// (= les clés réellement présentes dans son objet fields), pour éviter
// que :commit ne remplace tout le document existant.
function fbBatchWrite(writes, config) {
  if (!writes.length) return;
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents:commit?key=${config.apiKey}`;
  Logger.log(`🔄 fbBatchWrite : Envoi d'un batch de ${writes.length} document(s)...`);
  try {
    const resp = UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({ writes }),
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    if (code >= 400) {
      let errorMsg = resp.getContentText();
      try {
        const errorObj = JSON.parse(errorMsg);
        if (errorObj.error && errorObj.error.message) {
          errorMsg = `${errorObj.error.status || 'ERREUR'} — ${errorObj.error.message}`;
        }
      } catch (e) {
        errorMsg = errorMsg.slice(0, 300);
      }
      Logger.log(`❌ fbBatchWrite ÉCHEC (HTTP ${code}) : ${errorMsg}`);
    } else {
      Logger.log(`✅ fbBatchWrite SUCCÈS : ${writes.length} document(s) synchronisé(s).`);
    }
  } catch (e) {
    Logger.log(`❌ fbBatchWrite Exception critique : ${e.toString()}`);
  }
}

function computeExpiry(text, arrivalIso, carrier) {
  if (!text) return '';
  const d = text.match(/(?:disposez?\s+de|pendant)\s+(\d+)\s+jours?/i);
  if (d) {
    const dt = new Date(arrivalIso);
    dt.setDate(dt.getDate() + parseInt(d[1]));
    return dt.toISOString().split('T')[0];
  }
  const dm = text.match(/avant\s+le\s+(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/i);
  if (dm) {
    const y = dm[3] ? (dm[3].length === 2 ? '20' + dm[3] : dm[3]) : new Date().getFullYear();
    return y + '-' + dm[2].padStart(2, '0') + '-' + dm[1].padStart(2, '0');
  }
  const MONTHS = {
    janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12
  };
  const dl = text.match(/(?:jusqu['`\u00b4]au|avant le)\s+(\d{1,2})\s+([a-z\u00e1\u00e9\u00fb\u00f4]+)/i);
  if (dl && MONTHS[dl[2].toLowerCase()]) {
    const mo = MONTHS[dl[2].toLowerCase()];
    const y = new Date().getFullYear();
    return y + '-' + String(mo).padStart(2, '0') + '-' + dl[1].padStart(2, '0');
  }
  const DEFAULTS = {
    colissimo: 15, chronopost: 14, chronofresh: 5, mondialrelay: 14,
    relaiscolis: 14, vintedgo: 14, ups: 14, dpd: 14, gls: 14, amazon: 14, laposte: 15
  };
  const days = DEFAULTS[carrier] || 14;
  const def = new Date(arrivalIso);
  def.setDate(def.getDate() + days);
  return def.toISOString().split('T')[0];
}

function extractSender(subject, body) {
  const m1 = (subject + ' ' + body).match(/expédié\s+par\s+([A-Z][^\n.]{2,40}?)(?:\n|\.|est)/i);
  if (m1) return m1[1].trim().substring(0, 50);
  const m2 = (subject + ' ' + body).match(/de\s+([A-Z][A-Z\s]{3,40}?)(?:\n|\.|est)/);
  if (m2 && m2[1].length < 50) return m2[1].trim();
  return '';
}

function syncGmailToFirebase() {
  const config = getConfig();
  Logger.log('Démarrage sync Gmail → Firebase pour ' + ACCOUNT_NAME);

  const props = PropertiesService.getScriptProperties();
  const lastSyncTimestamp = props.getProperty('LAST_SYNC_TIMESTAMP') || '';
  
  let dateFilter = ' newer_than:3d';
  if (lastSyncTimestamp) {
    const afterSeconds = Math.floor(parseInt(lastSyncTimestamp) / 1000) - 60;
    dateFilter = ` after:${afterSeconds}`;
  }
  
  const query = 'subject:(colis OR pickup OR livraison OR disponible OR tracking)' + dateFilter;
  const threads = GmailApp.search(query, 0, 40);
  
  let newCount = 0;
  const batchWrites = [];
  
  for (const thread of threads) {
    const msgs = thread.getMessages();
    const firstFrom = (msgs[0]?.getFrom() || '').toLowerCase();
    const isKnown = CARRIERS.some(d => d.test(firstFrom, '', ''));
    if (!isKnown) continue;
    
    const msg = msgs[msgs.length - 1];
    const msgId = msg.getId();

    const from = (msg.getFrom() || '').toLowerCase();
    const subject = (msg.getSubject() || '');
    let body = (msg.getPlainBody() || '');
    if (!body.trim()) {
      body = msg.getBody().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const full = subject + '\n' + body;
    const slo = subject.toLowerCase();
    const blo = body.toLowerCase();
    const det = CARRIERS.find(d => d.test(from, slo, blo));
    if (!det) continue;

    const c = det.c;
    const tracking = extractTracking(c, full);
    const code = extractCode(full);
    const address = extractAddress(full);
    const status = detectStatus(full);
    const slot = extractDeliverySlot(full);
    if (!tracking && !code && !address) continue;

    const arrivalDate = msg.getDate().toISOString();
    const expiryDate = computeExpiry(full, arrivalDate, c);
    const docData = {
      id: msgId,
      _fbId: msgId,
      carrier: c,
      trackingNum: tracking,
      pickupCode: code,
      lockerAddress: address.substring(0, 200),
      deliverySlot: slot,
      sender: extractSender(subject, body),
      arrivalDate: arrivalDate,
      expiryDate: expiryDate,
      status: status,
      emailSubject: subject.substring(0, 100).trim().replace(/[\r\n]/g, ''),
      gmailLink: 'https://mail.google.com/mail/u/0/#inbox/' + msgId,
      account: ACCOUNT_NAME,
      source: 'gmail',
      gmailMsgId: msgId,
      note: '',
      lastUpdated: new Date().toISOString(),
      events: JSON.stringify([{ date: arrivalDate, status: status, desc: 'Gmail' }])
    };

    const docFields = toFirestoreFields(docData);
    batchWrites.push({
      update: {
        name: `projects/${config.projectId}/databases/(default)/documents/colis/${msgId}`,
        fields: docFields
      },
      // FIX CRITIQUE : limite l'écriture aux clés réellement envoyées
      updateMask: { fieldPaths: Object.keys(docFields) }
    });
    newCount++;
  }

  if (batchWrites.length > 0) {
    fbBatchWrite(batchWrites, config);
  }

  props.setProperty('LAST_SYNC_TIMESTAMP', String(Date.now()));
  Logger.log('Sync terminée : ' + newCount + ' colis traités pour ' + ACCOUNT_NAME);
  
  if (batchWrites.length > 0) {
    try {
      const logMsg = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
        + ' · ' + ACCOUNT_NAME + ' · ' + newCount + ' traité(s)';
      const logUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/meta/lastGmailSync?key=${config.apiKey}`
        + '&updateMask.fieldPaths=log&updateMask.fieldPaths=account&updateMask.fieldPaths=newCount&updateMask.fieldPaths=updatedAt';
      
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
  Logger.log('Déclencheur supprimé');
}
