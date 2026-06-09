/* ═══════════════════════════════════════════════════════════════
   FamilyHub — fbSync.js  v4.0
   Phase 4 : Real-time sync via polling REST Firestore
   ───────────────────────────────────────────────────
   - fbSubscribe(collection, onData, opts) : polling toutes les 5s
   - fbUnsubscribe(collection)             : arrêt du polling
   - fbQueue(collection, id, data)         : write avec retry expo
   - fbDeleteQueue(collection, id)         : delete avec retry expo
   - Sync indicateur visuel via FBSyncUI   : point header vert/orange/rouge
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // ── Config ────────────────────────────────────────────────────
  var FB_PROJECT = 'familyhub-colis-8abbd';
  var POLL_MS    = 5000;   // intervalle polling
  var RETRY_MAX  = 30000;  // retry max 30s
  var QUEUE_KEY  = 'fb_wq'; // localStorage write queue

  // ── Helpers Firebase REST ─────────────────────────────────────
  function getKey() {
    try { var s = JSON.parse(localStorage.getItem('lt_fb')); return s && s.apiKey ? s.apiKey : ''; } catch (e) { return ''; }
  }
  function fbUrl(path) {
    return 'https://firestore.googleapis.com/v1/projects/' + FB_PROJECT +
      '/databases/(default)/documents/' + path + '?key=' + getKey();
  }
  function toF(o) {
    var f = {};
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (v == null) return;
      if (typeof v === 'string')  f[k] = { stringValue: v };
      else if (typeof v === 'number')  f[k] = { doubleValue: v };
      else if (typeof v === 'boolean') f[k] = { booleanValue: v };
    });
    return f;
  }
  function frD(doc) {
    var o = {};
    if (!doc.fields) return o;
    Object.keys(doc.fields).forEach(function (k) {
      var v = doc.fields[k];
      if (v.stringValue  !== undefined) o[k] = v.stringValue;
      else if (v.doubleValue  !== undefined) o[k] = v.doubleValue;
      else if (v.integerValue !== undefined) o[k] = parseInt(v.integerValue, 10);
      else if (v.booleanValue !== undefined) o[k] = v.booleanValue;
      else if (v.arrayValue   !== undefined) {
        o[k] = (v.arrayValue.values || []).map(function (item) {
          if (item.stringValue !== undefined) { try { return JSON.parse(item.stringValue); } catch (e) { return item.stringValue; } }
          return '';
        });
      } else o[k] = '';
    });
    return o;
  }

  // ── Write Queue (retry exponentiel) ───────────────────────────
  function loadQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch (e) { return []; }
  }
  function saveQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) {}
  }
  function enqueue(op) {
    var q = loadQueue();
    // Dédupliquer : remplacer op existante sur même coll/id
    q = q.filter(function (x) { return !(x.coll === op.coll && x.id === op.id); });
    op.retryDelay = 1000;
    op.nextRetry  = Date.now();
    q.push(op);
    saveQueue(q);
    _flushQueue();
  }

  var _flushTimer = null;
  function _flushQueue() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(_doFlush, 100);
  }
  async function _doFlush() {
    _flushTimer = null;
    if (!getKey()) return;
    var q = loadQueue();
    if (!q.length) return;
    var now = Date.now();
    var remaining = [];
    for (var i = 0; i < q.length; i++) {
      var op = q[i];
      if (op.nextRetry > now) { remaining.push(op); continue; }
      try {
        var ok = false;
        if (op.type === 'DELETE') {
          var r = await fetch(fbUrl(op.coll + '/' + op.id), { method: 'DELETE', redirect: 'follow' });
          ok = r.ok;
        } else {
          var r2 = await fetch(fbUrl(op.coll + '/' + op.id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: toF(op.data) }),
            redirect: 'follow'
          });
          ok = r2.ok;
        }
        if (!ok) throw new Error('HTTP ' + (r || r2).status);
        FBSyncUI.setStatus('ok');
        // succès : ne pas remettre dans la queue
      } catch (e) {
        // retry exponentiel
        op.retryDelay = Math.min(op.retryDelay * 2, RETRY_MAX);
        op.nextRetry  = Date.now() + op.retryDelay;
        remaining.push(op);
        FBSyncUI.setStatus('error');
      }
    }
    saveQueue(remaining);
    if (remaining.length) {
      var nextMs = Math.min.apply(null, remaining.map(function (x) { return x.nextRetry - Date.now(); }));
      setTimeout(_doFlush, Math.max(nextMs, 500));
    }
  }

  // ── API publique write/delete ──────────────────────────────────
  function fbQueue(coll, id, data) {
    console.log("Tentative d'écriture dans : " + collection, data); // LOG ICI  
    enqueue({ type: 'WRITE', coll: coll, id: String(id), data: data });
  }
  function fbDeleteQueue(coll, id) {
    enqueue({ type: 'DELETE', coll: coll, id: String(id) });
  }

  // ── Polling ───────────────────────────────────────────────────
  var _polls = {}; // { collection: { timer, lastEtag, cb, opts } }

  function fbSubscribe(collection, onData, opts) {
    opts = opts || {};
    fbUnsubscribe(collection); // éviter double poll
    _polls[collection] = { cb: onData, opts: opts, timer: null, etag: null, errors: 0 };
    _poll(collection);
    // Pause quand app en arrière-plan
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { _pausePoll(collection); }
      else                 { _resumePoll(collection); }
    });
  }

  function fbUnsubscribe(collection) {
    if (_polls[collection]) {
      clearTimeout(_polls[collection].timer);
      delete _polls[collection];
    }
  }

  function _pausePoll(collection) {
    if (_polls[collection]) clearTimeout(_polls[collection].timer);
  }
  function _resumePoll(collection) {
    if (_polls[collection]) _poll(collection);
  }

  async function _poll(collection) {
    var entry = _polls[collection];
    if (!entry) return;
    if (!getKey()) {
      entry.timer = setTimeout(function () { _poll(collection); }, POLL_MS);
      return;
    }
    FBSyncUI.setStatus('syncing');
    try {
      var url = fbUrl(collection) + '&pageSize=500';
      var r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var data = await r.json();
      var docs = (data.documents || []).map(function (x) {
        return Object.assign(frD(x), { _fbId: x.name.split('/').pop() });
      });
      entry.errors = 0;
      FBSyncUI.setStatus('ok');
      entry.cb(docs);
    } catch (e) {
      entry.errors++;
      FBSyncUI.setStatus('error');
    }
    if (_polls[collection]) {
      entry.timer = setTimeout(function () { _poll(collection); }, POLL_MS);
    }
  }

  // ── Indicateur visuel ─────────────────────────────────────────
  // Injecte un point coloré dans l'élément #syncDot si présent
  // Statuts : ok (vert) | syncing (orange clignotant) | error (rouge)
  var FBSyncUI = {
    _status: 'ok',
    setStatus: function (s) {
      this._status = s;
      this._render();
    },
    _render: function () {
      var dot = document.getElementById('syncDot');
      if (!dot) return;
      var colors = { ok: '#22c55e', syncing: '#f59e0b', error: '#ef4444' };
      dot.style.background = colors[this._status] || colors.ok;
      dot.style.animation  = this._status === 'syncing' ? 'fbPulse 1s infinite' : 'none';
    }
  };

  // ── Init : flush queue au démarrage ──────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _flushQueue);
  } else {
    setTimeout(_flushQueue, 500);
  }

  // ── Export global ─────────────────────────────────────────────
  global.FBSync = {
    subscribe:   fbSubscribe,
    unsubscribe: fbUnsubscribe,
    write:       fbQueue,
    delete:      fbDeleteQueue,
    ui:          FBSyncUI,
    flush:       _flushQueue
  };

})(window);
