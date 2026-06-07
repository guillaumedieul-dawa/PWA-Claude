/* ═══════════════════════════════════════════
   FamilyHub — theme.js
   Gestion thème : light | dark | sepia
   Persistance : localStorage key 'fh_theme'
═══════════════════════════════════════════ */
(function () {
  'use strict';

  const THEMES = ['light', 'dark', 'sepia'];
  const KEY = 'fh_theme';

  /* ── Appliquer un thème ── */
  function applyTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    
    // 1. Application immédiate sur la racine pour le CSS
    document.documentElement.setAttribute('data-theme', t);
    
    // 2. Sauvegarde locale
    localStorage.setItem(KEY, t);
    
    // 3. Mise à jour sécurisée des éléments si le DOM est prêt
    if (document.body) {
      document.body.setAttribute('data-theme', t);
    }
    
    const btn = document.getElementById('thbtn');
    if (btn) {
      btn.textContent = t === 'dark' ? '🌙' : t === 'sepia' ? '📜' : '☀️';
    }

    document.querySelectorAll('.theme-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.t === t);
    });
  }

  /* ── Initialisation au chargement (Invoqué dans le head) ── */
  function initTheme() {
    const saved = localStorage.getItem(KEY);
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (sys ? 'dark' : 'light'));
  }

  /* ── Basculer dynamiquement au clic ── */
  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(cur);
    applyTheme(THEMES[(idx + 1) % THEMES.length]);
  };

  /* ── Exécution immédiate pour la racine HTML ── */
  initTheme();
  
  /* ── Deuxième passe de sécurité une fois le DOM chargé pour lier le bouton ── */
  document.addEventListener('DOMContentLoaded', function() {
    const saved = localStorage.getItem(KEY) || 'light';
    applyTheme(saved);
  });
})();
