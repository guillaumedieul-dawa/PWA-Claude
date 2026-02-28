/**
 * LockerTrack — SMS Bridge
 * Fait le pont entre le plugin Capacitor SMS et le moteur de parsing LockerTrack.
 * Ce fichier est injecté dans l'app via Capacitor webDir.
 *
 * Fonctionnement :
 *  1. Détecte si on est dans l'APK natif (window.Capacitor présent)
 *  2. Demande la permission READ_SMS à Android
 *  3. Lit les SMS des 90 derniers jours
 *  4. Filtre les SMS transporteurs connus
 *  5. Les passe au parseur LockerTrack existant (parseEmailToPackage adapté)
 *  6. Déduplique par hash SMS et insère les nouveaux colis
 */

// ═══════════════════════════════════════════
//  DÉTECTION ENVIRONNEMENT
// ═══════════════════════════════════════════

const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform
  ? window.Capacitor.isNativePlatform()
  : window.Capacitor);

// ═══════════════════════════════════════════
//  MOTS-CLÉS TRANSPORTEURS (SMS)
// ═══════════════════════════════════════════

const SMS_CARRIER_PATTERNS = [
  { carrier: 'chronopost',   regex: /chronopost|chrono\s*post/i },
  { carrier: 'colissimo',    regex: /colissimo|la\s*poste.*colis|colis.*la\s*poste/i },
  { carrier: 'mondialrelay', regex: /mondial\s*relay|point\s*relais|relais\s*colis/i },
  { carrier: 'laposte',      regex: /la\s*poste(?!.*colissimo)/i },
  { carrier: 'vintedgo',     regex: /vinted|vintedgo|vinted\s*go/i },
  { carrier: 'amazon',       regex: /amazon|amzn/i },
  { carrier: 'dpd',          regex: /\bdpd\b/i },
  { carrier: 'ups',          regex: /\bups\b/i },
];

// Mots-clés minimum pour confirmer que c'est un SMS colis
const SMS_PACKAGE_KEYWORDS = /colis|colissimo|chronopost|relais|locker|consigne|retrait|livr[ée]|expédi[ée]|disponible|code.*retrait|pin.*:\s*\d{4}/i;

// ═══════════════════════════════════════════
//  PARSING SMS → PACKAGE
// ═══════════════════════════════════════════

function detectCarrierFromSMS(body, sender) {
  const text = (body + ' ' + (sender || '')).toLowerCase();
  for (const { carrier, regex } of SMS_CARRIER_PATTERNS) {
    if (regex.test(text)) return carrier;
  }
  return 'other';
}

function parseSMStoPackage(sms) {
  const body    = sms.body    || '';
  const sender  = sms.address || sms.sender || '';
  const date    = sms.date    ? new Date(parseInt(sms.date)) : new Date();

  if (!SMS_PACKAGE_KEYWORDS.test(body + ' ' + sender)) return null;

  const carrier = detectCarrierFromSMS(body, sender);

  // ── Numéro de suivi ──
  const tracking = extractTrackingNumber(carrier, body + ' ' + body);

  // ── Code de retrait ──
  const code = extractPickupCode(body);

  // ── Adresse ──
  const address = extractAddress(carrier, body);

  // ── Statut ──
  const status = detectStatus(body);

  // ── Date d'expiration ──
  const expiryDate = extractExpiryDate(body, date.toISOString(), carrier);

  // Hash unique basé sur expéditeur + date (déduplification)
  const smsHash = 'sms_' + btoa(unescape(encodeURIComponent(sender + '|' + sms.date))).slice(0, 20);

  return {
    id:            Date.now() + Math.random(),
    carrier,
    status,
    lockerAddress: address || (carrier !== 'other' ? 'Adresse non détectée' : null),
    pickupCode:    code || '',
    qrData:        code || '',
    trackingNum:   tracking || '',
    arrivalDate:   date.toISOString(),
    expiryDate:    expiryDate || null,
    source:        'sms',
    account:       0,
    gmailLink:     null,
    emailSubject:  body.substring(0, 100),
    smsHash,
    note:          ''
  };
}

// ═══════════════════════════════════════════
//  LECTURE SMS VIA CAPACITOR
// ═══════════════════════════════════════════

async function readSMSNative() {
  // Import dynamique du plugin Capacitor SMS
  const { CapacitorSMS } = await import('./node_modules/capacitor-sms/dist/esm/index.js')
    .catch(() => null);

  if (!CapacitorSMS) {
    // Fallback : essai via l'API Capacitor globale
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SMS) {
      return window.Capacitor.Plugins.SMS;
    }
    throw new Error('Plugin SMS non disponible');
  }
  return CapacitorSMS;
}

async function requestSMSPermissionAndSync() {
  if (!IS_NATIVE) {
    showToast('⚠️ Requiert l\'APK natif');
    return;
  }

  const resultEl = document.getElementById('smsSyncResult');
  const lastSyncEl = document.getElementById('lastSyncSMS');

  try {
    showToast('📱 Demande de permission SMS…');

    // Demande de permission via Capacitor
    const { Permissions } = window.Capacitor.Plugins;
    if (Permissions) {
      const perm = await Permissions.request({ name: 'read-sms' }).catch(() => null);
      if (perm && perm.read_sms === 'denied') {
        showToast('❌ Permission SMS refusée');
        return;
      }
    }

    showToast('🔍 Lecture des SMS transporteurs…');

    // Lecture des SMS (90 derniers jours)
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let messages = [];

    const smsPlugin = await readSMSNative();

    // L'API varie selon le plugin — on essaie les deux formes
    if (smsPlugin.getSMS) {
      const result = await smsPlugin.getSMS({ indexFrom: 0, indexTo: 500 });
      messages = result.messages || result || [];
    } else if (smsPlugin.getMessages) {
      const result = await smsPlugin.getMessages({ folder: 'inbox', filter: { minDate: since } });
      messages = result.messages || [];
    }

    // Filtrage par date et mots-clés
    const relevant = messages.filter(m => {
      const ts = parseInt(m.date || m.timestamp || 0);
      return ts >= since && SMS_PACKAGE_KEYWORDS.test((m.body || m.message || '') + ' ' + (m.address || ''));
    });

    if (relevant.length === 0) {
      showToast('Aucun SMS transporteur trouvé');
      if (resultEl) { resultEl.style.display = 'block'; resultEl.textContent = 'Aucun SMS transporteur dans les 90 derniers jours.'; }
      return;
    }

    // Parsing et déduplification
    const existingHashes = new Set(appData.packages.map(p => p.smsHash).filter(Boolean));
    let added = 0, updated = 0;

    for (const sms of relevant) {
      const pkg = parseSMStoPackage({ ...sms, body: sms.body || sms.message || '' });
      if (!pkg || !pkg.lockerAddress) continue;

      if (existingHashes.has(pkg.smsHash)) {
        // Mettre à jour le statut si le colis existe déjà
        const existing = appData.packages.find(p => p.smsHash === pkg.smsHash);
        if (existing && pkg.status !== 'pending') {
          existing.status = pkg.status;
          if (pkg.pickupCode) existing.pickupCode = pkg.pickupCode;
          updated++;
        }
        continue;
      }

      appData.packages.unshift(pkg);
      existingHashes.add(pkg.smsHash);
      added++;
    }

    saveData(appData);
    render();

    const summary = `${added} nouveau(x) · ${updated} mis à jour · sur ${relevant.length} SMS analysés`;
    showToast(`✓ SMS : ${summary}`);

    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<strong>${summary}</strong><br><small>${relevant.length} SMS transporteurs trouvés</small>`;
    }
    if (lastSyncEl) {
      const now = new Date();
      lastSyncEl.innerHTML = '🔄 Dernière sync SMS<br><span style="font-family:\'Space Mono\',monospace;font-size:11px;">'
        + now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })
        + ' à ' + now.toLocaleTimeString('fr-FR') + '</span>';
    }

    // Mémoriser l'horodatage
    localStorage.setItem('lockertrack_last_sms_sync', new Date().toISOString());

  } catch (err) {
    console.error('SMS sync error:', err);
    showToast('❌ Erreur lecture SMS : ' + (err.message || err));
  }
}

// ═══════════════════════════════════════════
//  SYNC SMS MANUELLE (coller un SMS)
// ═══════════════════════════════════════════

function syncSMSManual() {
  const input = document.getElementById('smsManualInput');
  if (!input || !input.value.trim()) {
    showToast('⚠️ Collez d\'abord un SMS');
    return;
  }

  const fakeSMS = {
    body: input.value.trim(),
    address: 'Manuel',
    date: Date.now().toString(),
    smsHash: 'manual_' + Date.now()
  };

  const pkg = parseSMStoPackage(fakeSMS);
  if (!pkg) {
    showToast('❌ Aucun colis détecté dans ce SMS');
    return;
  }

  pkg.smsHash = fakeSMS.smsHash;
  appData.packages.unshift(pkg);
  saveData(appData);
  render();
  input.value = '';

  showToast(`✓ Colis ${pkg.carrier} ajouté depuis SMS`);
  showView('packages', document.querySelector('.nav-item'));
}

// ═══════════════════════════════════════════
//  INIT UI SMS
// ═══════════════════════════════════════════

function initSMSUI() {
  const bridgeUI = document.getElementById('smsBridgeUI');
  const manualUI = document.getElementById('smsManualUI');
  const smsStatus = document.getElementById('smsStatus');
  const smsSyncBtn = document.getElementById('smsSyncBtn');
  const smsTitle = document.getElementById('smsTitle');

  // Restaurer l'horodatage de la dernière sync
  const lastSync = localStorage.getItem('lockertrack_last_sms_sync');
  const lastSyncEl = document.getElementById('lastSyncSMS');
  if (lastSync && lastSyncEl) {
    const d = new Date(lastSync);
    lastSyncEl.innerHTML = '🔄 Dernière sync SMS<br><span style="font-family:\'Space Mono\',monospace;font-size:11px;">'
      + d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })
      + ' à ' + d.toLocaleTimeString('fr-FR') + '</span>';
  }

  if (IS_NATIVE) {
    // APK natif — affiche le bouton de sync automatique
    if (smsTitle) smsTitle.textContent = 'SMS Transporteurs';
    if (smsStatus) smsStatus.textContent = 'Lecture automatique disponible';
    if (bridgeUI) bridgeUI.style.display = 'block';
    if (smsSyncBtn) smsSyncBtn.style.display = 'inline-flex';
  } else {
    // PWA web — saisie manuelle uniquement
    if (smsTitle) smsTitle.textContent = 'SMS (saisie manuelle)';
    if (smsStatus) smsStatus.textContent = 'Mode navigateur — collez vos SMS';
    if (manualUI) manualUI.style.display = 'block';
  }
}

// Lancer l'init UI SMS au chargement
document.addEventListener('DOMContentLoaded', initSMSUI);
// Ou si le DOM est déjà prêt
if (document.readyState !== 'loading') setTimeout(initSMSUI, 100);

// Exporter pour usage inline dans index.html
window.requestSMSPermissionAndSync = requestSMSPermissionAndSync;
window.syncSMSManual = syncSMSManual;
