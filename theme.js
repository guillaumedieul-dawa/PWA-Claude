/* ═══════════════════════════════════════════
   FamilyHub — theme.js
   Gestion thème : light | dark | sepia
   Persistance : localStorage key 'fh_theme'
═══════════════════════════════════════════ */
(function () {
  'use strict';

  const THEMES = ['light', 'dark', 'sepia'];
  const KEY = 'fh_theme';

  function applyTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    
    // Application directe sur la balise html (obligatoire pour WebView)
    document.documentElement.setAttribute('data-theme', t);
    
    if (document.body) {
      document.body.setAttribute('data-theme', t);
    }

    localStorage.setItem(KEY, t);
    
    // Synchroniser l'icône du bouton
    const btn = document.getElementById('thbtn');
    if (btn) {
      btn.textContent = t === 'dark' ? '🌙' : t === 'sepia' ? '📜' : '☀️';
    }

    // Synchroniser les points si présents
    document.querySelectorAll('.theme-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.t === t);
    });
  }

  function initTheme() {
    const saved = localStorage.getItem(KEY);
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (sys ? 'dark' : 'light'));
  }

  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(cur);
    applyTheme(THEMES[(idx + 1) % THEMES.length]);
  };

  // Lancement immédiat au chargement du script
  initTheme();
  
  // Sécurité d'exécution dès que le DOM est prêt
  document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem(KEY) || 'light';
    applyTheme(saved);
  });
})();
