/* ═══════════════════════════════════════════════════════════════
   FamilyHub — fbSync.js v4.0 (Modifié avec Alertes UI)
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var FB_PROJECT = 'familyhub-colis-8abbd';
  var POLL_MS    = 5000;
  var RETRY_MAX  = 30000;
  var QUEUE_KEY  = 'fb_wq';

  function getKey() {
    try { var s = JSON.parse(localStorage.getItem('lt_fb')); return s && s.apiKey ? s.apiKey : ''; } catch (e) { return ''; }
  }
  function fbUrl(path) {
    return 'https://firestore.googleapis.com/v1/projects/' + FB_PROJECT +
      '/databases/(default)/documents/' + path + '?key=' + getKey();
  }

  // UI Helper pour les erreurs
  var FBSyncUI = {
    _status: 'ok',
    setStatus: function (s) {
      this._status = s;
      this._render();
    },
    showError: function(msg) {
      this.setStatus('error');
      // Alerte visible sur mobile
      alert("Erreur Sync Firebase : " + msg);
    },
    _render: function () {
      var dot = document.getElementById('syncDot');
      if (!dot) return;
      var colors = { ok: '#22c55e', syncing: '#f59e0b', error: '#ef4444' };
      dot.style.background = colors[this._status] || colors.ok;
      dot.style.animation  = this._status === 'syncing' ? 'fbPulse 1s infinite' : 'none';
    }
  };

  // Queue Management
  function fbQueue(collection, id, data) {
    var q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    q.push({ type: 'write', collection: collection, id: id, data: data, ts: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    _flushQueue();
  }

  function fbDeleteQueue(collection, id) {
    var q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    q.push({ type: 'delete', collection: collection, id: id, ts: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    _flushQueue();
  }

  function _flushQueue() {
    var q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (q.length === 0) return;

    var item = q[0];
    var url = fbUrl(item.collection + '/' + item.id);
    var options = { method: item.type === 'write' ? 'PATCH' : 'DELETE' };
    
    if (item.type === 'write') {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify({ fields: item.data });
    }

    fetch(url, options)
      .then(function(res) {
        if (!res.ok) throw new Error('Status ' + res.status);
        q.shift();
        localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
        _flushQueue();
      })
      .catch(function(err) {
        FBSyncUI.showError("Impossible de synchroniser. Vérifiez votre clé API et votre connexion. Erreur: " + err.message);
      });
  }

  // Polling
  var _polls = {};
  function fbSubscribe(coll, cb) {
    _polls[coll] = { cb: cb, errors: 0 };
    _poll(coll);
  }
  function fbUnsubscribe(coll) { delete _polls[coll]; }

  function _poll(coll) {
    var entry = _polls[coll];
    if (!entry) return;
    
    fetch(fbUrl(coll))
      .then(function(res) { 
        if(!res.ok) throw new Error('Connexion échec');
        return res.json(); 
      })
      .then(function(data) {
        entry.errors = 0;
        FBSyncUI.setStatus('ok');
        var docs = (data.documents || []).map(function(x) {
            // Mapping basique Firestore -> JSON
            return { _fbId: x.name.split('/').pop() }; 
        });
        entry.cb(docs);
        entry.timer = setTimeout(function() { _poll(coll); }, POLL_MS);
      })
      .catch(function(e) {
        entry.errors++;
        FBSyncUI.setStatus('error');
        entry.timer = setTimeout(function() { _poll(coll); }, POLL_MS);
      });
  }

  global.FBSync = {
    subscribe: fbSubscribe,
    write: fbQueue,
    delete: fbDeleteQueue,
    flush: _flushQueue
  };

})(window);
