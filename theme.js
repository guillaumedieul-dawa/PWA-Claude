(function () {
  'use strict';
  const THEMES = ['light', 'dark', 'sepia'];
  const KEY = 'fh_theme';

  function applyTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    
    document.documentElement.setAttribute('data-theme', t);
    if (document.body) document.body.setAttribute('data-theme', t);
    
    localStorage.setItem(KEY, t);
    
    // Mise à jour visuelle des boutons (compatibilité ID thbtn)
    const btn = document.getElementById('thbtn');
    if (btn) {
      btn.textContent = t === 'dark' ? '🌙' : t === 'sepia' ? '📜' : '☀️';
    }
  }

  // Fonction globale pour tous les modules
  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(cur);
    applyTheme(THEMES[(idx + 1) % THEMES.length]);
  };

  // Initialisation au chargement
  const saved = localStorage.getItem(KEY);
  const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (sys ? 'dark' : 'light'));
})();
